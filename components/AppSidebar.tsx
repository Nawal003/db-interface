"use client";

import { Database, GitMerge, Plus } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { DatasetRow } from "./DatasetRow";
import { DatabaseRow } from "./DatabaseRow";

interface Props {
  datasets: Dataset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImportClick: () => void;
  onMergeClick: () => void;
  onRenamed: () => void;
  onDeleted: (ids: string[]) => void;
}

type SidebarItem =
  | { kind: "file"; dataset: Dataset }
  | { kind: "db"; path: string; name: string; tables: Dataset[] };

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

/** Standalone files stay as-is; SQLite tables are grouped by their .db file. */
function buildSidebarItems(datasets: Dataset[]): SidebarItem[] {
  const items: SidebarItem[] = [];
  const dbAt = new Map<string, number>();
  for (const d of datasets) {
    if (d.sourceTable == null) {
      items.push({ kind: "file", dataset: d });
    } else if (dbAt.has(d.sourcePath)) {
      (items[dbAt.get(d.sourcePath)!] as Extract<SidebarItem, { kind: "db" }>)
        .tables.push(d);
    } else {
      dbAt.set(d.sourcePath, items.length);
      items.push({
        kind: "db",
        path: d.sourcePath,
        name: baseName(d.sourcePath),
        tables: [d],
      });
    }
  }
  for (const it of items) {
    if (it.kind === "db")
      it.tables.sort((a, b) => a.name.localeCompare(b.name));
  }
  return items;
}

export function AppSidebar({
  datasets,
  selectedId,
  onSelect,
  onImportClick,
  onMergeClick,
  onRenamed,
  onDeleted,
}: Props) {
  const items = buildSidebarItems(datasets);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-14 items-center gap-2.5 border-b px-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-secondary/40 bg-secondary/10 text-secondary">
            <Database className="size-5" />
          </div>
          <span className="font-heading text-base font-semibold">
            DB Interface
          </span>
        </div>
        <div className="px-3 pt-3 pb-1">
          <Button
            variant="outline"
            onClick={onImportClick}
            className="h-10 w-full gap-2 border-secondary/40 bg-secondary/10 font-medium text-secondary hover:bg-secondary/15 hover:text-secondary dark:border-secondary/40 dark:bg-secondary/10 dark:text-secondary dark:hover:bg-secondary/15"
          >
            <Plus /> Importer un fichier
          </Button>
          <Button
            variant="ghost"
            onClick={onMergeClick}
            disabled={datasets.length === 0}
            className="mt-1.5 h-9 w-full gap-2 text-muted-foreground hover:text-foreground"
          >
            <GitMerge className="size-4" /> Fusionner / nettoyer
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-wider">
            Données
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {items.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                Aucun jeu de données. Importez un fichier pour commencer.
              </p>
            ) : (
              <SidebarMenu className="gap-2">
                {items.map((item) =>
                  item.kind === "file" ? (
                    <DatasetRow
                      key={item.dataset.id}
                      dataset={item.dataset}
                      isActive={item.dataset.id === selectedId}
                      onSelect={onSelect}
                      onRenamed={onRenamed}
                      onDeleted={(id) => onDeleted([id])}
                    />
                  ) : (
                    <DatabaseRow
                      key={item.path}
                      name={item.name}
                      tables={item.tables}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onDeleted={onDeleted}
                    />
                  ),
                )}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
