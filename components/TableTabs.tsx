"use client";

import { Database } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  dbName: string;
  tables: Dataset[];
  activeId: string;
  onSelect: (id: string) => void;
}

/** Horizontal table switcher shown above a SQLite database's table view. */
export function TableTabs({ dbName, tables, activeId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Database className="size-3.5 text-secondary" />
        <span className="max-w-40 truncate font-mono">{dbName}</span>
      </span>
      <div className="flex items-center gap-1">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              t.id === activeId
                ? "bg-secondary/15 text-secondary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
