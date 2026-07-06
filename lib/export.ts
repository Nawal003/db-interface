import * as XLSX from "xlsx";
import { getDb } from "./db";
import type { Column, Dataset } from "./types";

export type ExportFormat = "csv" | "json" | "xlsx";

export interface ExportOptions {
  /** Ordered internal column keys (c0..cN) to include. */
  keys: string[];
  format: ExportFormat;
  /** Optional global text filter, matching the grid's search. */
  q?: string;
}

/** Resolve the requested keys to known columns, preserving the caller's order. */
function resolveColumns(ds: Dataset, keys: string[]): Column[] {
  const cols = keys
    .map((k) => ds.columns.find((c) => c.key === k))
    .filter((c): c is Column => Boolean(c));
  if (cols.length === 0) throw new Error("Aucune colonne valide sélectionnée");
  return cols;
}

/** Build the WHERE clause + params for the grid's global text filter. */
function buildWhere(ds: Dataset, q?: string): { where: string; params: string[] } {
  if (!q || ds.columns.length === 0) return { where: "", params: [] };
  const like = `%${q}%`;
  return {
    where: "WHERE " + ds.columns.map((c) => `${c.key} LIKE ?`).join(" OR "),
    params: ds.columns.map(() => like),
  };
}

function baseName(ds: Dataset): string {
  return ds.name.replace(/\.[^.]+$/, "") || "export";
}

function csvCell(v: string | null): string {
  if (v == null) return "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function csvLine(values: (string | null)[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

export interface ExportStream {
  filename: string;
  contentType: string;
  stream: ReadableStream<Uint8Array>;
}

/**
 * Stream a CSV/JSON export row-by-row via a SQLite cursor, so exporting a
 * multi-GB dataset never materializes the whole file in memory.
 */
export function buildExportStream(ds: Dataset, opts: ExportOptions): ExportStream {
  const cols = resolveColumns(ds, opts.keys);
  const { where, params } = buildWhere(ds, opts.q);
  const select = cols.map((c) => c.key).join(", ");
  const iterator = getDb()
    .prepare(`SELECT ${select} FROM "${ds.tableName}" ${where} ORDER BY _rid ASC`)
    .iterate(...params) as IterableIterator<Record<string, string | null>>;

  const names = cols.map((c) => c.name);
  const base = baseName(ds);
  const enc = new TextEncoder();
  const CHUNK = 500;
  const isJson = opts.format === "json";

  let started = false;
  let first = true;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      try {
        let buf = "";
        if (!started) {
          buf += isJson ? "[\n" : csvLine(names);
          started = true;
        }
        for (let n = 0; n < CHUNK; n++) {
          const res = iterator.next();
          if (res.done) {
            buf += isJson ? (first ? "]\n" : "\n]\n") : "";
            if (buf) controller.enqueue(enc.encode(buf));
            controller.close();
            return;
          }
          const r = res.value;
          if (isJson) {
            const obj: Record<string, string | null> = {};
            cols.forEach((c) => (obj[c.name] = r[c.key] ?? null));
            buf += (first ? "  " : ",\n  ") + JSON.stringify(obj);
            first = false;
          } else {
            buf += csvLine(cols.map((c) => r[c.key] ?? ""));
          }
        }
        controller.enqueue(enc.encode(buf));
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      try {
        iterator.return?.();
      } catch {
        // ignore
      }
    },
  });

  return {
    filename: isJson ? `${base}_export.json` : `${base}_export.csv`,
    contentType: isJson
      ? "application/json; charset=utf-8"
      : "text/csv; charset=utf-8",
    stream,
  };
}

export interface ExportResult {
  filename: string;
  contentType: string;
  body: Buffer;
}

/** Build an XLSX export (held in memory — for moderate-sized datasets). */
export function buildXlsxExport(ds: Dataset, opts: ExportOptions): ExportResult {
  const cols = resolveColumns(ds, opts.keys);
  const { where, params } = buildWhere(ds, opts.q);
  const select = cols.map((c) => c.key).join(", ");
  const rows = getDb()
    .prepare(`SELECT ${select} FROM "${ds.tableName}" ${where} ORDER BY _rid ASC`)
    .all(...params) as unknown as Record<string, string | null>[];

  const names = cols.map((c) => c.name);
  const aoa: (string | null)[][] = [
    names,
    ...rows.map((r) => cols.map((c) => r[c.key] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return {
    filename: `${baseName(ds)}_export.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: buf,
  };
}
