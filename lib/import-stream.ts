// Streaming import for the row-based formats (CSV/TSV/text): parse the file as a
// stream and insert into SQLite in batches, so memory stays constant regardless
// of file size (multi-GB files won't blow up the heap). JSON/XLSX stay in-memory
// (rarely huge; not cheaply streamable), see lib/parse.ts.
import fs from "node:fs";
import readline from "node:readline";
import Papa from "papaparse";
import { getDb } from "./db";
import type { Column, ColumnType } from "./types";

const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;
const BATCH = 2000;

export interface StreamResult {
  columns: Column[];
  rowCount: number;
}

/**
 * Stream a delimited (CSV/TSV) file into a freshly (re)created table, inferring
 * column types in a single pass. Resolves with the columns + row count.
 */
export function streamDelimitedIntoTable(
  tableName: string,
  filePath: string,
  format: "csv" | "tsv",
): Promise<StreamResult> {
  const db = getDb();
  return new Promise<StreamResult>((resolve, reject) => {
    let columns: Column[] | null = null;
    let insertBatch: ((rows: (string | null)[][]) => void) | null = null;
    const numeric: boolean[] = [];
    const sawValue: boolean[] = [];
    let rowCount = 0;
    let batch: (string | null)[][] = [];
    let failed = false;

    const rs = fs.createReadStream(filePath);
    const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
      delimiter: format === "tsv" ? "\t" : "",
      skipEmptyLines: "greedy",
    });

    const fail = (e: unknown) => {
      if (failed) return;
      failed = true;
      rs.destroy();
      reject(e instanceof Error ? e : new Error(String(e)));
    };

    const flush = () => {
      if (insertBatch && batch.length > 0) {
        insertBatch(batch);
        batch = [];
      }
    };

    parser.on("data", (row: string[]) => {
      if (failed) return;
      try {
        if (!columns) {
          // First row = header.
          columns = row.map((h, i) => ({
            name:
              h != null && String(h).trim() !== "" ? String(h) : `column_${i + 1}`,
            key: `c${i}`,
            type: "text" as ColumnType,
          }));
          columns.forEach((_, i) => {
            numeric[i] = true;
            sawValue[i] = false;
          });
          db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
          const defs = columns.map((c) => `${c.key} TEXT`).join(", ");
          db.exec(
            `CREATE TABLE "${tableName}" (_rid INTEGER PRIMARY KEY AUTOINCREMENT${
              defs ? ", " + defs : ""
            })`,
          );
          if (columns.length > 0) {
            const cols = columns.map((c) => c.key).join(", ");
            const ph = columns.map(() => "?").join(", ");
            const stmt = db.prepare(
              `INSERT INTO "${tableName}" (${cols}) VALUES (${ph})`,
            );
            insertBatch = db.transaction((rows: (string | null)[][]) => {
              for (const r of rows) stmt.run(...r);
            });
          }
          return;
        }
        if (columns.length === 0) return;
        const values = columns.map((_, i) => {
          const v = row[i];
          if (v == null || v === "") return null;
          const s = String(v);
          sawValue[i] = true;
          if (numeric[i] && !NUMBER_RE.test(s.trim())) numeric[i] = false;
          return s;
        });
        batch.push(values);
        rowCount++;
        if (batch.length >= BATCH) flush();
      } catch (e) {
        fail(e);
      }
    });

    parser.on("end", () => {
      if (failed) return;
      try {
        if (!columns) {
          // Empty file -> empty table.
          db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
          db.exec(
            `CREATE TABLE "${tableName}" (_rid INTEGER PRIMARY KEY AUTOINCREMENT)`,
          );
          resolve({ columns: [], rowCount: 0 });
          return;
        }
        flush();
        columns.forEach((c, i) => {
          c.type = sawValue[i] && numeric[i] ? "number" : "text";
        });
        resolve({ columns, rowCount });
      } catch (e) {
        fail(e);
      }
    });

    parser.on("error", fail);
    rs.on("error", fail);
    rs.pipe(parser);
  });
}

/** Stream a plain-text/log file into a table: one row per line, single "line" column. */
export function streamTextIntoTable(
  tableName: string,
  filePath: string,
): Promise<StreamResult> {
  const db = getDb();
  return new Promise<StreamResult>((resolve, reject) => {
    let failed = false;
    try {
      db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      db.exec(
        `CREATE TABLE "${tableName}" (_rid INTEGER PRIMARY KEY AUTOINCREMENT, c0 TEXT)`,
      );
    } catch (e) {
      reject(e);
      return;
    }
    const stmt = db.prepare(`INSERT INTO "${tableName}" (c0) VALUES (?)`);
    const insertBatch = db.transaction((rows: (string | null)[]) => {
      for (const r of rows) stmt.run(r);
    });
    let batch: (string | null)[] = [];
    let rowCount = 0;

    const rs = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });

    rl.on("line", (line) => {
      if (failed) return;
      try {
        batch.push(line === "" ? null : line);
        rowCount++;
        if (batch.length >= BATCH) {
          insertBatch(batch);
          batch = [];
        }
      } catch (e) {
        failed = true;
        rl.close();
        rs.destroy();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    rl.on("close", () => {
      if (failed) return;
      try {
        if (batch.length > 0) insertBatch(batch);
        resolve({
          columns: [{ name: "line", key: "c0", type: "text" }],
          rowCount,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    rs.on("error", (e) => {
      if (failed) return;
      failed = true;
      reject(e);
    });
  });
}
