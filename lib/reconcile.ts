import fs from "node:fs";
import { getDb } from "./db";
import { deleteDataset, getDataset, listDatasets } from "./store";
import type { Dataset, DatasetStatus } from "./types";

function setStatus(id: string, status: DatasetStatus): void {
  getDb().prepare("UPDATE datasets SET status = ? WHERE id = ?").run(status, id);
}

/**
 * Reconcile one dataset against its source file:
 * - source missing/renamed/moved -> dataset is deleted ("deleted")
 * - content changed (mtime or size differs) -> marked "modified"
 * - otherwise -> "ok"
 */
export function reconcileOne(ds: Dataset): DatasetStatus | "deleted" {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(ds.sourcePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    deleteDataset(ds.id);
    return "deleted";
  }

  const changed =
    Math.floor(stat.mtimeMs) !== ds.sourceMtimeMs || stat.size !== ds.sourceSize;
  const next: DatasetStatus = changed ? "modified" : "ok";
  if (next !== ds.status) setStatus(ds.id, next);
  return next;
}

/** Reconcile every dataset, then return the surviving datasets (fresh state). */
export function reconcileAll(): Dataset[] {
  for (const ds of listDatasets()) reconcileOne(ds);
  return listDatasets();
}

/** Reconcile a single dataset by id; returns the fresh dataset or null if removed. */
export function reconcileById(id: string): Dataset | null {
  const ds = getDataset(id);
  if (!ds) return null;
  const result = reconcileOne(ds);
  if (result === "deleted") return null;
  return getDataset(id);
}
