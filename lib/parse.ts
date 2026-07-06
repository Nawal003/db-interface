import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ColumnType, ParsedTable, SourceFormat } from "./types";

const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

/** Map a file extension to a supported source format. Returns null if unsupported. */
export function detectFormat(filePath: string): SourceFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".csv":
      return "csv";
    case ".tsv":
      return "tsv";
    case ".json":
      return "json";
    case ".xlsx":
    case ".xls":
      return "xlsx";
    case ".txt":
    case ".log":
    case ".md":
      return "text";
    case ".sqlite":
    case ".sqlite3":
    case ".db":
      return "sqlite";
    case ".sql":
      return "sql";
    default:
      return null;
  }
}

/** True if the file starts with the SQLite magic header ("SQLite format 3\0"). */
export function isSqliteFile(filePath: string): boolean {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    return n === 16 && buf.toString("latin1") === "SQLite format 3\0";
  } catch {
    return false;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

/** Quote a SQLite identifier for safe interpolation. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function cellToString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return String(v);
  if (v instanceof Uint8Array) return "[blob]";
  return String(v);
}

/** User tables (excluding internal sqlite_* tables) of an open connection. */
function userTables(db: Database.Database): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as unknown as { name: string }[];
  return rows.map((r) => r.name);
}

/** Read one table from an open connection into a uniform tabular shape. */
function readTable(db: Database.Database, tableName: string): ParsedTable {
  const info = db
    .prepare(`PRAGMA table_info(${quoteIdent(tableName)})`)
    .all() as unknown as { name: string }[];
  const columns = info.map((c) => c.name);
  const raw = db
    .prepare(`SELECT * FROM ${quoteIdent(tableName)}`)
    .all() as unknown as Record<string, unknown>[];
  const rows = raw.map((r) => columns.map((name) => cellToString(r[name])));
  return { format: "sqlite", columns, types: inferTypes(columns, rows), rows };
}

/** List the user tables of a local SQLite database file. */
export function listSqliteTables(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return userTables(db);
  } finally {
    db.close();
  }
}

/** Read one table of a local SQLite database into a uniform tabular shape. */
export function parseSqliteTable(
  dbPath: string,
  tableName: string,
): ParsedTable {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return readTable(db, tableName);
  } finally {
    db.close();
  }
}

/**
 * Split a SQL script into individual statements on `;`, while respecting
 * quoted strings/identifiers and comments so semicolons inside them don't split.
 */
function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  const n = sql.length;
  for (let i = 0; i < n; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") cur += sql[i++];
      cur += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      cur += sql[i++];
      cur += sql[i++];
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) cur += sql[i++];
      if (i < n) cur += sql[i++] + sql[i];
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      cur += sql[i++];
      while (i < n) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            cur += sql[i++] + sql[i];
          } else {
            cur += sql[i];
            break;
          }
        } else {
          cur += sql[i];
        }
        i++;
      }
      continue;
    }
    if (ch === ";") {
      const s = cur.trim();
      if (s) out.push(s);
      cur = "";
      continue;
    }
    cur += ch;
  }
  const s = cur.trim();
  if (s) out.push(s);
  return out;
}

/** Extract the target table + column names from an `INSERT INTO t (cols) VALUES` statement. */
function parseInsertTarget(
  stmt: string,
): { table: string; columns: string[] } | null {
  const m =
    /^\s*insert\s+(?:or\s+\w+\s+)?into\s+([^\s(]+)\s*\(([^)]*)\)\s*values/i.exec(
      stmt,
    );
  if (!m) return null;
  const strip = (s: string) => s.trim().replace(/^["`[]|["`\]]$/g, "");
  const table = strip(m[1]);
  const columns = m[2].split(",").map(strip).filter(Boolean);
  if (!table || columns.length === 0) return null;
  return { table, columns };
}

const SQL_INCOMPATIBLE =
  "Impossible de lire ce script SQL (dialecte non compatible SQLite ?). " +
  "Les dumps PostgreSQL/MySQL (pg_dump, mysqldump) ne s’exécutent pas dans " +
  "SQLite — préférez un export CSV, ou un dump SQLite.";

/**
 * Execute a .sql script into an in-memory database. Tries the whole script
 * first; on failure, replays it statement by statement, skipping the ones
 * SQLite can't run, so a valid subset still imports. Throws if nothing usable
 * results (e.g. a Postgres/MySQL dump).
 */
function runSqlScript(filePath: string): Database.Database {
  const content = fs.readFileSync(filePath, "utf8");

  // Fast path: a fully SQLite-compatible script.
  let db = new Database(":memory:");
  let detail = "";
  try {
    db.exec(content);
    return db;
  } catch (e) {
    detail = (e as Error).message;
    db.close();
  }

  // Tolerant path: run statement by statement. Skip ones SQLite can't run, and
  // for INSERTs into an undefined table (data-only dumps, e.g. Mockaroo), infer
  // the table from the INSERT's column list and create it, then retry.
  db = new Database(":memory:");
  for (const stmt of splitSqlStatements(content)) {
    try {
      db.exec(stmt);
      continue;
    } catch {
      // fall through to recovery
    }
    const target = parseInsertTarget(stmt);
    if (target) {
      try {
        db.exec(
          `CREATE TABLE IF NOT EXISTS ${quoteIdent(target.table)} (${target.columns
            .map(quoteIdent)
            .join(", ")})`,
        );
        db.exec(stmt);
      } catch {
        // still unusable — skip
      }
    }
  }

  // A schema-only script yields empty tables — that's valid (the structure is
  // still useful). Only fail when nothing usable came out at all.
  if (userTables(db).length === 0) {
    db.close();
    throw new Error(
      detail ? `${SQL_INCOMPATIBLE} (détail SQLite : ${detail})` : SQL_INCOMPATIBLE,
    );
  }
  return db;
}

/** Run a .sql script and return every resulting table as a parsed table. */
export function readSqlTables(
  filePath: string,
): { name: string; parsed: ParsedTable }[] {
  const db = runSqlScript(filePath);
  try {
    return userTables(db).map((name) => ({ name, parsed: readTable(db, name) }));
  } finally {
    db.close();
  }
}

/** Re-run a .sql script and return one table (used on resync). */
export function parseSqlTable(filePath: string, tableName: string): ParsedTable {
  const db = runSqlScript(filePath);
  try {
    return readTable(db, tableName);
  } finally {
    db.close();
  }
}

/** Infer a display type per column from its values (fidelity: values stay text). */
function inferTypes(columns: string[], rows: (string | null)[][]): ColumnType[] {
  return columns.map((_, c) => {
    let sawValue = false;
    for (const row of rows) {
      const v = row[c];
      if (v == null || v === "") continue;
      sawValue = true;
      if (!NUMBER_RE.test(v.trim())) return "text";
    }
    return sawValue ? "number" : "text";
  });
}

/** Build a table from an array of header + row arrays, normalizing ragged rows. */
function fromRows(
  format: SourceFormat,
  header: string[],
  dataRows: (string | null)[][],
): ParsedTable {
  const columns = header.map((h, i) =>
    h != null && String(h).trim() !== "" ? String(h) : `column_${i + 1}`,
  );
  const rows = dataRows.map((r) =>
    columns.map((_, i) => {
      const v = r[i];
      return v == null || v === "" ? null : String(v);
    }),
  );
  return { format, columns, types: inferTypes(columns, rows), rows };
}

function parseDelimited(format: "csv" | "tsv", content: string): ParsedTable {
  const res = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter: format === "tsv" ? "\t" : "",
  });
  const data = res.data as string[][];
  if (data.length === 0) return { format, columns: [], types: [], rows: [] };
  return fromRows(format, data[0], data.slice(1));
}

function parseJson(content: string): ParsedTable {
  const parsed = JSON.parse(content);

  // Array of objects -> tabular (union of keys in first-seen order).
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { format: "json", columns: [], types: [], rows: [] };
    if (parsed.every((el) => el !== null && typeof el === "object" && !Array.isArray(el))) {
      const keys: string[] = [];
      for (const obj of parsed) {
        for (const k of Object.keys(obj)) if (!keys.includes(k)) keys.push(k);
      }
      const rows = parsed.map((obj) =>
        keys.map((k) => {
          const v = (obj as Record<string, unknown>)[k];
          if (v == null) return null;
          return typeof v === "object" ? JSON.stringify(v) : String(v);
        }),
      );
      return fromRows("json", keys, rows);
    }
    // Array of scalars -> single "value" column.
    const rows = parsed.map((v) => [v == null ? null : String(v)]);
    return fromRows("json", ["value"], rows);
  }

  // Single object -> one row keyed by its properties.
  if (parsed !== null && typeof parsed === "object") {
    const keys = Object.keys(parsed);
    const row = keys.map((k) => {
      const v = (parsed as Record<string, unknown>)[k];
      if (v == null) return null;
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
    return fromRows("json", keys, [row]);
  }

  // Bare scalar.
  return fromRows("json", ["value"], [[parsed == null ? null : String(parsed)]]);
}

function parseText(content: string): ParsedTable {
  const lines = content.split(/\r?\n/);
  // Drop a single trailing empty line from the final newline.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return fromRows("text", ["line"], lines.map((l) => [l]));
}

function parseXlsx(filePath: string): ParsedTable {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { format: "xlsx", columns: [], types: [], rows: [] };
  const aoa = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (aoa.length === 0) return { format: "xlsx", columns: [], types: [], rows: [] };
  return fromRows("xlsx", aoa[0], aoa.slice(1));
}

/** Parse any supported file at `filePath` into a uniform tabular table. */
export function parseFile(filePath: string, format: SourceFormat): ParsedTable {
  if (format === "xlsx") return parseXlsx(filePath);
  if (format === "sqlite" || format === "sql")
    throw new Error("Une base/script SQL se lit table par table");
  const content = fs.readFileSync(filePath, "utf8");
  switch (format) {
    case "csv":
    case "tsv":
      return parseDelimited(format, content);
    case "json":
      return parseJson(content);
    case "text":
      return parseText(content);
  }
}
