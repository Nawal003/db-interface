import Database from "better-sqlite3";
import { DB_PATH, ensureDataDirs } from "./paths";

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __dbadminDb?: Database.Database };

function createDb(): Database.Database {
  ensureDataDirs();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      format          TEXT NOT NULL,
      source_path     TEXT NOT NULL,
      source_table    TEXT,
      source_mtime_ms INTEGER NOT NULL,
      source_size     INTEGER NOT NULL,
      table_name      TEXT NOT NULL,
      raw_copy_path   TEXT NOT NULL,
      columns_json    TEXT NOT NULL,
      row_count       INTEGER NOT NULL,
      status          TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      last_synced_at  INTEGER NOT NULL
    );
  `);
  // Migrate databases created before the SQLite-source feature.
  try {
    db.exec("ALTER TABLE datasets ADD COLUMN source_table TEXT");
  } catch {
    // column already exists
  }
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__dbadminDb) {
    globalForDb.__dbadminDb = createDb();
  }
  return globalForDb.__dbadminDb;
}
