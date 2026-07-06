"use client";

import { ChevronDown, Columns3 } from "lucide-react";
import type { Column } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  columns: Column[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function ColumnSelect({ columns, selected, onChange }: Props) {
  const allSelected = selected.size === columns.length;

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(columns.map((c) => c.key)));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="h-10 cursor-pointer px-4">
            <Columns3 /> Colonnes
            <span className="text-muted-foreground tabular-nums">
              {selected.size}/{columns.length}
            </span>
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex items-center justify-between gap-2 px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">
            Colonnes
          </span>
          <button
            onClick={toggleAll}
            className="cursor-pointer text-xs font-medium text-primary hover:underline"
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {columns.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.key}
              checked={selected.has(c.key)}
              onCheckedChange={() => toggle(c.key)}
              closeOnClick={false}
              className="cursor-pointer"
            >
              <span className="truncate">{c.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
