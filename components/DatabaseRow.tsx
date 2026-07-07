"use client";

import { useState } from "react";
import {
  ChevronRight,
  Database,
  MoreHorizontal,
  Table,
  Trash2,
} from "lucide-react";
import type { Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface Props {
  /** The database file name (display label). */
  name: string;
  /** The datasets (tables) belonging to this database, ordered. */
  tables: Dataset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleted: (ids: string[]) => void;
}

export function DatabaseRow({
  name,
  tables,
  selectedId,
  onSelect,
  onDeleted,
}: Props) {
  const [open, setOpen] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = tables.some((t) => t.id === selectedId);
  const modified = tables.some((t) => t.status === "modified");
  const plural = tables.length > 1 ? "s" : "";

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      for (const t of tables) {
        const res = await fetch(`/api/datasets/${t.id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204)
          throw new Error("Échec de la suppression");
      }
      setDeleteOpen(false);
      onDeleted(tables.map((t) => t.id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setOpen((o) => !o)}
        isActive={isActive && !open}
        className={cn(
          "relative cursor-pointer gap-2 overflow-hidden rounded-lg border py-2 pr-9 pl-2.5",
          isActive && !open
            ? "border-border"
            : "border-border/60 bg-card/30 hover:bg-muted/50",
        )}
      >
        {isActive && !open && (
          <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-secondary" />
        )}
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <Database className="size-4 shrink-0 text-secondary" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {name}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[11px]",
            modified ? "text-amber-500" : "text-muted-foreground",
          )}
        >
          {tables.length} table{plural}
        </span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction className="top-2 cursor-pointer peer-data-[size=default]/menu-button:top-2">
              <MoreHorizontal />
              <span className="sr-only">Options de la base</span>
            </SidebarMenuAction>
          }
        />
        <DropdownMenuContent side="right" align="start" className="w-44">
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => {
              setError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 /> Retirer la base
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {open && (
        <SidebarMenuSub className="mr-0 gap-0.5 pr-0">
          {tables.map((t) => (
            <SidebarMenuSubItem key={t.id}>
              <SidebarMenuSubButton
                isActive={t.id === selectedId}
                onClick={() => onSelect(t.id)}
                className="cursor-pointer"
              >
                <Table className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.name}</span>
                {t.status === "modified" && (
                  <span
                    className="ml-auto text-amber-500"
                    title="Modifié"
                    aria-hidden
                  >
                    ●
                  </span>
                )}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer « {name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cela retire la base et ses {tables.length} table{plural} du
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
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  );
}
