import fs from "node:fs";
import path from "node:path";

/**
 * Root folder where the program keeps its own copies + SQLite db.
 * Electron sets DBADMIN_DATA_DIR to the OS user-data dir; otherwise (dev / plain
 * `next`) it falls back to `./.data` in the project (gitignored).
 */
export const DATA_DIR = process.env.DBADMIN_DATA_DIR
  ? path.resolve(process.env.DBADMIN_DATA_DIR)
  : path.join(process.cwd(), ".data");
export const FILES_DIR = path.join(DATA_DIR, "files");
export const DB_PATH = path.join(DATA_DIR, "app.db");

/** Create the storage folders on first use. Safe to call repeatedly. */
export function ensureDataDirs(): void {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}
