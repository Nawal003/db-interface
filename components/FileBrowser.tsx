"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ArrowUp,
  File as FileIcon,
  Folder,
  Home,
  LoaderCircle,
} from "lucide-react";
import type { BrowseResult } from "@/lib/browse";
import type { Dataset } from "@/lib/types";
import { fetcher } from "@/lib/fetcher";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (dataset: Dataset) => void;
}

export default function FileBrowser({ open, onOpenChange, onImported }: Props) {
  // `undefined` path -> API defaults to the user's home directory.
  const [path, setPath] = useState<string | undefined>(undefined);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only fetch while the dialog is open.
  const key = !open
    ? null
    : path
      ? `/api/fs?path=${encodeURIComponent(path)}`
      : "/api/fs";
  const { data, isLoading } = useSWR<BrowseResult>(key, fetcher, {
    keepPreviousData: true,
  });

  async function importFile(filePath: string) {
    setImporting(filePath);
    setError(null);
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Échec de l’import");
      onImported(body.dataset as Dataset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle>Importer un fichier de données</DialogTitle>
          <DialogDescription>
            Cliquez sur un dossier pour naviguer, sur un fichier pour l’importer.
            Les fichiers CSV, TSV, JSON, XLSX, texte, bases SQLite (.db /
            .sqlite) et scripts .sql sont affichés.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-y bg-muted/40 px-3 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPath(data?.home)}
            title="Accueil"
          >
            <Home />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => data?.parent && setPath(data.parent)}
            disabled={!data?.parent}
            title="Dossier parent"
          >
            <ArrowUp />
          </Button>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {data?.path ?? "…"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Chargement…
            </div>
          ) : data && data.entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun dossier ou fichier importable ici.
            </div>
          ) : (
            <ul className="divide-y">
              {data?.entries.map((e) => (
                <li key={e.path}>
                  <button
                    onClick={() =>
                      e.isDir ? setPath(e.path) : importFile(e.path)
                    }
                    disabled={importing !== null}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    {e.isDir ? (
                      <Folder className="size-4 shrink-0 text-sky-500" />
                    ) : (
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{e.name}</span>
                    {!e.isDir && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {importing === e.path
                          ? "import…"
                          : formatBytes(e.size)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
