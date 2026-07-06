"use client";

import { useState } from "react";
import { MoreHorizontal, SquarePen, Trash2 } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-emerald-500",
  modified: "bg-amber-500",
  orphaned: "bg-red-500",
};

interface Props {
  dataset: Dataset;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRenamed: () => void;
  onDeleted: (id: string) => void;
}

export function DatasetRow({
  dataset,
  isActive,
  onSelect,
  onRenamed,
  onDeleted,
}: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(dataset.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Échec du renommage");
      setRenameOpen(false);
      onRenamed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${dataset.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204)
        throw new Error("Échec de la suppression");
      setDeleteOpen(false);
      onDeleted(dataset.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onSelect(dataset.id)}
        className={cn(
          "relative h-auto cursor-pointer items-start overflow-hidden rounded-lg border py-2.5 pr-9 pl-3.5",
          isActive
            ? "border-border"
            : "border-border/60 bg-card/30 hover:bg-muted/50",
        )}
      >
        {isActive && (
          <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-secondary" />
        )}
        <span
          className={cn(
            "mt-1 size-2 shrink-0 rounded-full",
            STATUS_STYLES[dataset.status] ?? "bg-muted-foreground",
          )}
          title={dataset.status}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {dataset.name}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {dataset.format.toUpperCase()} · {formatCount(dataset.rowCount)}{" "}
            lignes
          </span>
        </span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction className="top-1/2 -translate-y-1/2 cursor-pointer peer-data-[size=default]/menu-button:top-1/2">
              <MoreHorizontal />
              <span className="sr-only">Options du jeu de données</span>
            </SidebarMenuAction>
          }
        />
        <DropdownMenuContent side="right" align="start" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              setName(dataset.name);
              setError(null);
              setRenameOpen(true);
            }}
          >
            <SquarePen /> Renommer
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => {
              setError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>Renommer le jeu de données</DialogTitle>
              <DialogDescription>
                Modifier le nom affiché dans l’application. Le fichier source
                n’est pas modifié.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={`rename-${dataset.id}`} className="sr-only">
                Nom
              </Label>
              <Input
                id={`rename-${dataset.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Annuler
              </DialogClose>
              <Button type="submit" disabled={busy || !name.trim()}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {dataset.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cela supprime le jeu de données, sa copie importée et sa table du
              programme. Le fichier source d’origine n’est pas touché.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={busy}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  );
}
