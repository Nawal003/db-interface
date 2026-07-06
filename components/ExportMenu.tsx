"use client";

import { ChevronDown, Upload } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  dataset: Dataset;
  /** Current text filter — the export mirrors what the grid shows. */
  q: string;
  /** Selected column keys (shared with the grid); exports only these. */
  selected: Set<string>;
}

const FORMATS: { format: string; label: string }[] = [
  { format: "csv", label: "CSV" },
  { format: "json", label: "JSON" },
  { format: "xlsx", label: "Excel (.xlsx)" },
];

export default function ExportMenu({ dataset, q, selected }: Props) {
  const allSelected = selected.size === dataset.columns.length;
  const canExport = selected.size > 0;

  function href(format: string) {
    const params = new URLSearchParams({ format });
    // Preserve on-screen column order; omit `keys` when everything is selected.
    if (!allSelected) {
      const keys = dataset.columns
        .filter((c) => selected.has(c.key))
        .map((c) => c.key);
      params.set("keys", keys.join(","));
    }
    if (q) params.set("q", q);
    return `/api/datasets/${dataset.id}/export?${params.toString()}`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="h-10 cursor-pointer px-4">
            <Upload /> Exporter <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {canExport
            ? `Exporter ${selected.size} colonne${selected.size > 1 ? "s" : ""} au format`
            : "Sélectionnez au moins une colonne"}
        </div>
        {FORMATS.map((f) => (
          <DropdownMenuItem
            key={f.format}
            disabled={!canExport}
            render={<a href={canExport ? href(f.format) : undefined} />}
            className="cursor-pointer"
          >
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
