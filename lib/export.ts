import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getDb } from "./db";
import type { Dataset } from "./types";

export type ExportFormat = "csv" | "json" | "xlsx";

export interface ExportOptions {
  /** Ordered internal column keys (c0..cN) to include. */
  keys: string[];
  format: ExportFormat;
  /** Optional global text filter, matching the grid's search. */
  q?: string;
}

export interface ExportResult {
  filename: string;
  contentType: string;
  body: Buffer | string;
}

/** Build an export file for the selected columns/order of a dataset. */
export function buildExport(ds: Dataset, opts: ExportOptions): ExportResult {
  // Keep only known keys, preserving the caller's order.
  const cols = opts.keys
    .map((k) => ds.columns.find((c) => c.key === k))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (cols.length === 0) throw new Error("Aucune colonne valide sélectionnée");

  const params: string[] = [];
  let where = "";
  if (opts.q && ds.columns.length > 0) {
    const like = `%${opts.q}%`;
    where = "WHERE " + ds.columns.map((c) => `${c.key} LIKE ?`).join(" OR ");
    for (const _ of ds.columns) params.push(like);
  }

  const select = cols.map((c) => c.key).join(", ");
  const rows = getDb()
    .prepare(`SELECT ${select} FROM "${ds.tableName}" ${where} ORDER BY _rid ASC`)
    .all(...params) as unknown as Record<string, string | null>[];

  const names = cols.map((c) => c.name);
  const base = ds.name.replace(/\.[^.]+$/, "") || "export";

  if (opts.format === "json") {
    const objects = rows.map((r) => {
      const o: Record<string, string | null> = {};
      cols.forEach((c) => (o[c.name] = r[c.key] ?? null));
      return o;
    });
    return {
      filename: `${base}_export.json`,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(objects, null, 2),
    };
  }

  const aoa: (string | null)[][] = [names, ...rows.map((r) => cols.map((c) => r[c.key] ?? ""))];

  if (opts.format === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return {
      filename: `${base}_export.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: buf,
    };
  }

  // CSV (default)
  return {
    filename: `${base}_export.csv`,
    contentType: "text/csv; charset=utf-8",
    body: Papa.unparse(aoa),
  };
}
