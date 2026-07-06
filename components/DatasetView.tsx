"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnSelect } from "./ColumnSelect";
import DataGrid from "./DataGrid";
import ExportMenu from "./ExportMenu";
import { TableTabs } from "./TableTabs";

interface Props {
  dataset: Dataset;
  onChanged: () => void;
  /** Sibling tables when this dataset is a SQLite database table. */
  tables?: Dataset[];
  onSelectTable?: (id: string) => void;
}

export default function DatasetView({
  dataset,
  onChanged,
  tables,
  onSelectTable,
}: Props) {
  const [rawQuery, setRawQuery] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Selected columns, all on by default. This component remounts when the
  // dataset changes (keyed by dataset id upstream), so the initializer re-runs.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(dataset.columns.map((c) => c.key)),
  );

  // Columns to show/export, kept in the dataset's original order.
  const visibleColumns = dataset.columns.filter((c) => selectedKeys.has(c.key));

  function deselect(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // Debounce the filter so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(rawQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [rawQuery]);

  async function resync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${dataset.id}/resync`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Échec de la resynchronisation");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-3 px-4 py-3">
        {dataset.sourceTable && tables && tables.length > 0 && onSelectTable && (
          <TableTabs
            dbName={dataset.sourcePath.split(/[\\/]/).pop() ?? dataset.sourcePath}
            tables={tables}
            activeId={dataset.id}
            onSelect={onSelectTable}
          />
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 truncate font-heading text-base font-semibold">
                {dataset.name}
              </h1>
              {dataset.status === "modified" && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-500"
                >
                  Modifié
                </Badge>
              )}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {dataset.sourcePath}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={resync}
              disabled={busy}
              className="h-10 px-4"
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Resynchroniser
            </Button>
            <ExportMenu dataset={dataset} q={q} selected={selectedKeys} />
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Rechercher dans toutes les colonnes…"
              className="h-10 pl-8 focus-visible:border-secondary focus-visible:ring-secondary/50"
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ColumnSelect
              columns={dataset.columns}
              selected={selectedKeys}
              onChange={setSelectedKeys}
            />
            <span className="text-xs text-muted-foreground">
              {formatCount(dataset.rowCount)} lignes
            </span>
          </div>
        </div>

        {/* Selected columns as removable chips. */}
        {visibleColumns.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Champs
            </span>
            {visibleColumns.map((c) => (
              <Badge
                key={c.key}
                variant="outline"
                className="h-auto max-w-48 gap-1.5 border-border bg-muted/40 py-1.5 pr-1 font-normal"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-secondary" />
                <span className="truncate">{c.name}</span>
                <button
                  type="button"
                  onClick={() => deselect(c.key)}
                  className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  aria-label={`Retirer la colonne ${c.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {dataset.status === "modified" && (
          <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-3.5" />
            Le fichier source a changé depuis l’import. Resynchronisez pour
            charger la dernière version.
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}
      </header>

      {visibleColumns.length > 0 ? (
        <DataGrid dataset={dataset} columns={visibleColumns} q={q} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Aucune colonne sélectionnée — choisissez les colonnes à afficher et à
          exporter.
        </div>
      )}
    </section>
  );
}
