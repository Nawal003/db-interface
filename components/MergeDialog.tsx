"use client";

import { useState } from "react";
import { Layers, GitMerge, CopyMinus } from "lucide-react";
import type { Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = "union" | "join" | "dedupe";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasets: Dataset[];
  onDone: (ds: Dataset) => void;
}

const selectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-secondary";

const MODES: { key: Mode; label: string; icon: typeof Layers; hint: string }[] = [
  { key: "union", label: "Empiler", icon: Layers, hint: "Ajouter les lignes de plusieurs fichiers (mêmes colonnes)" },
  { key: "join", label: "Joindre", icon: GitMerge, hint: "Combiner deux fichiers sur une colonne commune" },
  { key: "dedupe", label: "Dédoublonner", icon: CopyMinus, hint: "Supprimer les lignes en double d’un fichier" },
];

function label(ds: Dataset): string {
  return ds.sourceTable ? `${ds.name}  ·  ${ds.columns.length} col.` : ds.name;
}

export default function MergeDialog({
  open,
  onOpenChange,
  datasets,
  onDone,
}: Props) {
  const [mode, setMode] = useState<Mode>("union");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unionIds, setUnionIds] = useState<string[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [joinType, setJoinType] = useState<"inner" | "left">("inner");
  const [dedupeId, setDedupeId] = useState("");
  const [dedupeKeys, setDedupeKeys] = useState<string[]>([]);

  const byId = (id: string) => datasets.find((d) => d.id === id);
  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function submit() {
    setError(null);
    let body: Record<string, unknown> | null = null;
    if (mode === "union") {
      if (unionIds.length < 2)
        return setError("Sélectionnez au moins deux jeux de données à empiler.");
      body = { op: "union", datasetIds: unionIds, name: name || undefined };
    } else if (mode === "join") {
      if (!leftId || !rightId || !leftKey || !rightKey)
        return setError("Choisissez les deux jeux et leur colonne clé.");
      body = {
        op: "join",
        leftId,
        rightId,
        leftKey,
        rightKey,
        joinType,
        name: name || undefined,
      };
    } else {
      if (!dedupeId) return setError("Choisissez un jeu de données.");
      body = {
        op: "dedupe",
        datasetId: dedupeId,
        keys: dedupeKeys.length ? dedupeKeys : undefined,
        name: name || undefined,
      };
    }
    setBusy(true);
    try {
      const res = await fetch("/api/datasets/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: { dataset?: Dataset; error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(res.ok ? "Réponse serveur invalide" : `Erreur serveur (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error ?? "Échec de l’opération");
      onDone(data.dataset as Dataset);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const left = byId(leftId);
  const right = byId(rightId);
  const dedupeDs = byId(dedupeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Fusionner / nettoyer des données</DialogTitle>
          <DialogDescription>
            Crée un nouveau jeu de données. Les fichiers d’origine restent intacts.
          </DialogDescription>
        </DialogHeader>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-1.5 px-5">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMode(m.key);
                setError(null);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors",
                mode === m.key
                  ? "border-secondary/50 bg-secondary/10 text-secondary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50",
              )}
            >
              <m.icon className="size-4" />
              {m.label}
            </button>
          ))}
        </div>
        <p className="px-5 pt-2 text-xs text-muted-foreground">
          {MODES.find((m) => m.key === mode)!.hint}
        </p>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {mode === "union" && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Jeux à empiler (2+)</span>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                {datasets.map((d) => (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-secondary"
                      checked={unionIds.includes(d.id)}
                      onChange={() => setUnionIds((a) => toggle(a, d.id))}
                    />
                    <span className="truncate">{label(d)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Alignement par nom de colonne (insensible à la casse) ; colonnes
                absentes → vides.
              </p>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Jeu de gauche</span>
                  <select className={selectCls} value={leftId} onChange={(e) => { setLeftId(e.target.value); setLeftKey(""); }}>
                    <option value="">—</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select className={selectCls} value={leftKey} onChange={(e) => setLeftKey(e.target.value)} disabled={!left}>
                    <option value="">Colonne clé…</option>
                    {left?.columns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Jeu de droite</span>
                  <select className={selectCls} value={rightId} onChange={(e) => { setRightId(e.target.value); setRightKey(""); }}>
                    <option value="">—</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select className={selectCls} value={rightKey} onChange={(e) => setRightKey(e.target.value)} disabled={!right}>
                    <option value="">Colonne clé…</option>
                    {right?.columns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Type :</span>
                {(["inner", "left"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setJoinType(t)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 text-xs",
                      joinType === t ? "border-secondary/50 bg-secondary/10 text-secondary" : "border-border/60 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {t === "inner" ? "Correspondances seules (inner)" : "Tout à gauche (left)"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "dedupe" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Jeu de données</span>
                <select className={selectCls} value={dedupeId} onChange={(e) => { setDedupeId(e.target.value); setDedupeKeys([]); }}>
                  <option value="">—</option>
                  {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {dedupeDs && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Colonnes à comparer</span>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                    {dedupeDs.columns.map((c) => (
                      <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                        <input type="checkbox" className="size-4 accent-secondary" checked={dedupeKeys.includes(c.key)} onChange={() => setDedupeKeys((a) => toggle(a, c.key))} />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aucune cochée = comparer <b>toutes</b> les colonnes (doublons exacts).
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Nom du résultat (optionnel)</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Clients fusionnés" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "En cours…" : "Créer le jeu de données"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
