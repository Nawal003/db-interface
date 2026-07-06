import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import {
  detectFormat,
  isSqliteFile,
  listSqliteTables,
  parseFile,
  parseSqliteTable,
  parseSqlTable,
  readSqlTables,
} from "./parse";
import { FILES_DIR, ensureDataDirs } from "./paths";
import {
  streamDelimitedIntoTable,
  streamTextIntoTable,
} from "./import-stream";
import type { Column, Dataset, ParsedTable, SourceFormat } from "./types";

interface DatasetRow {
  id: string;
  name: string;
  format: string;
  source_path: string;
  source_table: string | null;
  source_mtime_ms: number;
  source_size: number;
  table_name: string;
  raw_copy_path: string;
  columns_json: string;
  row_count: number;
  status: string;
  created_at: number;
  last_synced_at: number;
}

function rowToDataset(r: DatasetRow): Dataset {
  return {
    id: r.id,
    name: r.name,
    format: r.format as Dataset["format"],
    sourcePath: r.source_path,
    sourceTable: r.source_table,
    sourceMtimeMs: r.source_mtime_ms,
    sourceSize: r.source_size,
    tableName: r.table_name,
    rawCopyPath: r.raw_copy_path,
    columns: JSON.parse(r.columns_json) as Column[],
    rowCount: r.row_count,
    status: r.status as Dataset["status"],
    createdAt: r.created_at,
    lastSyncedAt: r.last_synced_at,
  };
}

export function listDatasets(): Dataset[] {
  const rows = getDb()
    .prepare("SELECT * FROM datasets ORDER BY created_at DESC")
    .all() as unknown as DatasetRow[];
  return rows.map(rowToDataset);
}

export function getDataset(id: string): Dataset | null {
  const row = getDb()
    .prepare("SELECT * FROM datasets WHERE id = ?")
    .get(id) as unknown as DatasetRow | undefined;
  return row ? rowToDataset(row) : null;
}

function getDatasetBySource(
  sourcePath: string,
  sourceTable: string | null,
): Dataset | null {
  const db = getDb();
  const row = (
    sourceTable == null
      ? db
          .prepare(
            "SELECT * FROM datasets WHERE source_path = ? AND source_table IS NULL",
          )
          .get(sourcePath)
      : db
          .prepare(
            "SELECT * FROM datasets WHERE source_path = ? AND source_table = ?",
          )
          .get(sourcePath, sourceTable)
  ) as unknown as DatasetRow | undefined;
  return row ? rowToDataset(row) : null;
}

/** (Re)create and fill a dynamic per-dataset table from a parsed table. */
function populateTable(tableName: string, parsed: ParsedTable): Column[] {
  const db = getDb();
  db.exec(`DROP TABLE IF EXISTS "${tableName}"`);

  const columns: Column[] = parsed.columns.map((name, i) => ({
    name,
    key: `c${i}`,
    type: parsed.types[i] ?? "text",
  }));

  const colDefs = columns.map((c) => `${c.key} TEXT`).join(", ");
  db.exec(
    `CREATE TABLE "${tableName}" (_rid INTEGER PRIMARY KEY AUTOINCREMENT${
      colDefs ? ", " + colDefs : ""
    })`,
  );

  if (columns.length > 0 && parsed.rows.length > 0) {
    const cols = columns.map((c) => c.key).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const stmt = db.prepare(
      `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`,
    );
    db.exec("BEGIN");
    try {
      for (const row of parsed.rows) {
        stmt.run(...columns.map((_, i) => row[i] ?? null));
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return columns;
}

function safeId(): string {
  return "ds_" + crypto.randomUUID().replace(/-/g, "");
}

interface InsertInput {
  id: string;
  name: string;
  format: SourceFormat;
  sourcePath: string;
  sourceTable: string | null;
  stat: fs.Stats;
  rawCopyPath: string;
  columns: Column[];
  rowCount: number;
}

function insertDataset(d: InsertInput): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO datasets
        (id, name, format, source_path, source_table, source_mtime_ms,
         source_size, table_name, raw_copy_path, columns_json, row_count,
         status, created_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      d.id,
      d.name,
      d.format,
      d.sourcePath,
      d.sourceTable,
      Math.floor(d.stat.mtimeMs),
      d.stat.size,
      d.id,
      d.rawCopyPath,
      JSON.stringify(d.columns),
      d.rowCount,
      "ok",
      now,
      now,
    );
}

/**
 * Fill a fresh table from a single-table file. Row-based formats (CSV/TSV/text)
 * stream in with constant memory; JSON/XLSX are parsed in-memory.
 */
async function fillTableFromFile(
  tableName: string,
  abs: string,
  format: SourceFormat,
): Promise<{ columns: Column[]; rowCount: number }> {
  if (format === "csv" || format === "tsv") {
    return streamDelimitedIntoTable(tableName, abs, format);
  }
  if (format === "text") {
    return streamTextIntoTable(tableName, abs);
  }
  const parsed = parseFile(abs, format);
  return { columns: populateTable(tableName, parsed), rowCount: parsed.rows.length };
}

/** Import a single-table file (CSV/TSV/JSON/XLSX/text): parse, copy, store. */
async function importSingleFile(
  abs: string,
  stat: fs.Stats,
  format: SourceFormat,
): Promise<Dataset> {
  const existing = getDatasetBySource(abs, null);
  if (existing) return existing;

  const id = safeId();
  const rawCopyPath = path.join(FILES_DIR, id + path.extname(abs));
  fs.copyFileSync(abs, rawCopyPath);
  const { columns, rowCount } = await fillTableFromFile(id, abs, format);

  insertDataset({
    id,
    name: path.basename(abs),
    format,
    sourcePath: abs,
    sourceTable: null,
    stat,
    rawCopyPath,
    columns,
    rowCount,
  });
  return getDataset(id)!;
}

/** Import one already-parsed table (from a SQLite db or a .sql script). */
function importTableDataset(
  abs: string,
  stat: fs.Stats,
  format: SourceFormat,
  tableName: string,
  parsed: ParsedTable,
): Dataset {
  const existing = getDatasetBySource(abs, tableName);
  if (existing) return existing;

  const id = safeId();
  const columns = populateTable(id, parsed);

  insertDataset({
    id,
    name: tableName,
    format,
    sourcePath: abs,
    sourceTable: tableName,
    stat,
    rawCopyPath: "",
    columns,
    rowCount: parsed.rows.length,
  });
  return getDataset(id)!;
}

/**
 * Import a local source into the program. A single-table file yields one
 * dataset; a SQLite database yields one dataset per table. Already-imported
 * sources return their existing datasets.
 */
export async function importSource(sourcePath: string): Promise<Dataset[]> {
  const abs = path.resolve(sourcePath);
  const stat = fs.statSync(abs); // throws if missing
  if (!stat.isFile()) throw new Error("Ce n’est pas un fichier : " + abs);

  const format = detectFormat(abs);
  if (!format)
    throw new Error("Type de fichier non pris en charge : " + path.extname(abs));

  ensureDataDirs();

  if (format === "sqlite") {
    if (!isSqliteFile(abs))
      throw new Error(
        "Fichier non reconnu comme base SQLite : " + path.basename(abs),
      );
    const tables = listSqliteTables(abs);
    if (tables.length === 0)
      throw new Error("Aucune table dans cette base SQLite");
    return tables.map((t) =>
      importTableDataset(abs, stat, "sqlite", t, parseSqliteTable(abs, t)),
    );
  }

  if (format === "sql") {
    const tables = readSqlTables(abs); // throws on incompatible SQL dialects
    if (tables.length === 0)
      throw new Error("Aucune table produite par ce script SQL");
    return tables.map(({ name, parsed }) =>
      importTableDataset(abs, stat, "sql", name, parsed),
    );
  }

  return [await importSingleFile(abs, stat, format)];
}

/** Re-read the source file and replace the stored copy + table + metadata. */
export async function resyncDataset(id: string): Promise<Dataset> {
  const ds = getDataset(id);
  if (!ds) throw new Error("Jeu de données introuvable");
  const stat = fs.statSync(ds.sourcePath); // throws if source now missing

  let columns: Column[];
  let rowCount: number;
  if (ds.sourceTable) {
    // A SQLite/SQL table source: re-read that one table (in-memory).
    const parsed =
      ds.format === "sql"
        ? parseSqlTable(ds.sourcePath, ds.sourceTable)
        : parseSqliteTable(ds.sourcePath, ds.sourceTable);
    columns = populateTable(ds.tableName, parsed);
    rowCount = parsed.rows.length;
  } else {
    // A plain file: stream CSV/TSV/text, parse JSON/XLSX in-memory.
    ({ columns, rowCount } = await fillTableFromFile(
      ds.tableName,
      ds.sourcePath,
      ds.format,
    ));
  }
  if (ds.rawCopyPath) fs.copyFileSync(ds.sourcePath, ds.rawCopyPath);
  const now = Date.now();

  getDb()
    .prepare(
      `UPDATE datasets SET source_mtime_ms = ?, source_size = ?, columns_json = ?,
         row_count = ?, status = 'ok', last_synced_at = ? WHERE id = ?`,
    )
    .run(
      Math.floor(stat.mtimeMs),
      stat.size,
      JSON.stringify(columns),
      rowCount,
      now,
      id,
    );

  return getDataset(id)!;
}

/** Change a dataset's display name. */
export function renameDataset(id: string, name: string): Dataset {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom ne peut pas être vide");
  const ds = getDataset(id);
  if (!ds) throw new Error("Jeu de données introuvable");
  getDb().prepare("UPDATE datasets SET name = ? WHERE id = ?").run(trimmed, id);
  return getDataset(id)!;
}

/** Remove a dataset entirely: drop its table, delete the raw copy + metadata. */
export function deleteDataset(id: string): void {
  const ds = getDataset(id);
  if (!ds) return;
  const db = getDb();
  db.exec(`DROP TABLE IF EXISTS "${ds.tableName}"`);
  // Only ever delete our own copies (never the user's source file, e.g. a .db).
  if (ds.rawCopyPath && ds.rawCopyPath.startsWith(FILES_DIR)) {
    try {
      fs.rmSync(ds.rawCopyPath, { force: true });
    } catch {
      // ignore missing copy
    }
  }
  db.prepare("DELETE FROM datasets WHERE id = ?").run(id);
}

export interface QueryOptions {
  q?: string;
  sort?: string; // a column key (c0..cN)
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface QueryResult {
  total: number;
  page: number;
  pageSize: number;
  rows: Record<string, string | null>[];
}

/** Page/sort/filter the rows of a dataset by internal column keys. */
export function queryRows(ds: Dataset, opts: QueryOptions): QueryResult {
  const db = getDb();
  const keys = new Set(ds.columns.map((c) => c.key));
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = Math.min(1000, Math.max(1, opts.pageSize ?? 100));

  const params: string[] = [];
  let where = "";
  if (opts.q && ds.columns.length > 0) {
    const like = `%${opts.q}%`;
    where =
      "WHERE " + ds.columns.map((c) => `${c.key} LIKE ?`).join(" OR ");
    for (const _ of ds.columns) params.push(like);
  }

  let orderBy = "ORDER BY _rid ASC";
  if (opts.sort && keys.has(opts.sort)) {
    const dir = opts.dir === "desc" ? "DESC" : "ASC";
    const col = ds.columns.find((c) => c.key === opts.sort)!;
    const expr = col.type === "number" ? `CAST(${col.key} AS REAL)` : col.key;
    orderBy = `ORDER BY ${expr} ${dir}, _rid ASC`;
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS n FROM "${ds.tableName}" ${where}`)
    .get(...params) as { n: number };

  const rows = db
    .prepare(
      `SELECT * FROM "${ds.tableName}" ${where} ${orderBy} LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, page * pageSize) as unknown as Record<
    string,
    string | null
  >[];

  return { total: totalRow.n, page, pageSize, rows };
}
