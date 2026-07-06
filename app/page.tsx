"use client";

import { useState } from "react";
import useSWR from "swr";
import { Database } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { fetcher } from "@/lib/fetcher";
import { getDesktop } from "@/lib/desktop";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import DatasetView from "@/components/DatasetView";
import FileBrowser from "@/components/FileBrowser";
import { ThemeToggle } from "@/components/theme-toggle";

interface DatasetsResponse {
  datasets: Dataset[];
}

export default function Home() {
  const { data, mutate } = useSWR<DatasetsResponse>("/api/datasets", fetcher);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const datasets = data?.datasets ?? [];
  // Derive the active dataset during render: honor the explicit choice while it
  // still exists, otherwise fall back to the first dataset.
  const selected =
    datasets.find((d) => d.id === selectedId) ?? datasets[0] ?? null;

  // Sibling tables when the active dataset is a SQLite database table.
  const dbTables =
    selected?.sourceTable != null
      ? datasets
          .filter(
            (d) =>
              d.sourceTable != null && d.sourcePath === selected.sourcePath,
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      : undefined;

  function handleImported(ds: Dataset) {
    setShowImport(false);
    setSelectedId(ds.id);
    mutate();
  }

  // In Electron: open the native OS file picker (real folder tree + correct
  // permissions). In a plain browser: fall back to the in-app file browser.
  async function handleImportClick() {
    const desktop = getDesktop();
    if (!desktop) {
      setShowImport(true);
      return;
    }
    setImportError(null);
    const filePath = await desktop.pickImportFile();
    if (!filePath) return;
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Échec de l’import");
      handleImported(body.dataset as Dataset);
    } catch (e) {
      setImportError((e as Error).message);
    }
  }

  function handleDeleted(ids: string[]) {
    setSelectedId((cur) => (cur && ids.includes(cur) ? null : cur));
    mutate();
  }

  return (
    <SidebarProvider>
      <AppSidebar
        datasets={datasets}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        onImportClick={handleImportClick}
        onRenamed={() => mutate()}
        onDeleted={handleDeleted}
      />

      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {importError && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <span className="truncate">Échec de l’import : {importError}</span>
            <button
              onClick={() => setImportError(null)}
              className="shrink-0 cursor-pointer font-medium underline"
            >
              Fermer
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {selected ? (
            <DatasetView
              key={selected.id}
              dataset={selected}
              onChanged={() => mutate()}
              tables={dbTables}
              onSelectTable={setSelectedId}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Database size={40} strokeWidth={1.25} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Aucun jeu de données sélectionné
                </p>
                <p className="text-xs">
                  Importez un fichier ou choisissez un jeu de données dans la
                  barre latérale.
                </p>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>

      <FileBrowser
        open={showImport}
        onOpenChange={setShowImport}
        onImported={handleImported}
      />
    </SidebarProvider>
  );
}
