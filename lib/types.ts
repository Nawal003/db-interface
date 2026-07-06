// Shared domain types for the data-admin tool.

export type SourceFormat =
  | "csv"
  | "tsv"
  | "json"
  | "xlsx"
  | "text"
  | "sqlite"
  | "sql";

export type ColumnType = "number" | "text";

/** A column as exposed to the UI. `key` is the internal SQLite column (c0..cN). */
export interface Column {
  /** Original column name from the source file (used as header + export label). */
  name: string;
  /** Internal, injection-safe SQLite column identifier: c0, c1, ... */
  key: string;
  /** Inferred display type (drives alignment + numeric sort). */
  type: ColumnType;
}

export type DatasetStatus = "ok" | "modified" | "orphaned";

/** Metadata row for an imported dataset. */
export interface Dataset {
  id: string;
  name: string;
  format: SourceFormat;
  sourcePath: string;
  /** For a SQLite source, the table read from within that database; else null. */
  sourceTable: string | null;
  sourceMtimeMs: number;
  sourceSize: number;
  tableName: string;
  rawCopyPath: string;
  columns: Column[];
  rowCount: number;
  status: DatasetStatus;
  createdAt: number;
  lastSyncedAt: number;
}

/** Result of parsing a source file into a uniform tabular shape. */
export interface ParsedTable {
  format: SourceFormat;
  columns: string[];
  types: ColumnType[];
  /** Row values preserved as original text (or null for missing cells). */
  rows: (string | null)[][];
}
