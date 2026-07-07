"use client";

import { useState } from "react";
import {
  Database,
  GitMerge,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
}

interface Step {
  icon: typeof Database;
  title: string;
  body: string;
  tips?: string[];
}

const STEPS: Step[] = [
  {
    icon: Database,
    title: "Bienvenue dans DB Interface",
    body: "Ouvrez, explorez et exportez vos fichiers de données locaux — entièrement hors ligne. Vos fichiers ne quittent jamais votre machine et ne sont jamais modifiés.",
    tips: [
      "Formats lus : CSV, TSV, JSON, Excel, texte, bases SQLite (.db/.sqlite) et scripts .sql",
      "Ce tutoriel reste accessible via le bouton ? en haut à droite",
    ],
  },
  {
    icon: Plus,
    title: "1 · Importer un fichier",
    body: "Cliquez sur « Importer un fichier » dans la barre latérale : le sélecteur de fichiers de votre système s’ouvre. Le fichier devient une carte de jeu de données.",
    tips: [
      "Une base SQLite ou un script SQL multi-tables s’affiche en arborescence : cliquez sur la carte pour la déplier, puis sur une table",
      "L’import de très gros fichiers CSV (plusieurs Go) est pris en charge",
    ],
  },
  {
    icon: Search,
    title: "2 · Explorer les données",
    body: "Sélectionnez un jeu de données pour ouvrir son tableau : recherche plein-texte, tri par clic sur un en-tête, pagination automatique.",
    tips: [
      "Élargissez une colonne en tirant sur son bord",
      "Le tri numérique est automatique pour les colonnes de nombres",
    ],
  },
  {
    icon: SlidersHorizontal,
    title: "3 · Choisir les colonnes",
    body: "Le bouton « Colonnes » (à droite de la recherche) permet d’afficher ou masquer chaque colonne. Les colonnes retenues apparaissent en chips sous la barre de recherche.",
    tips: [
      "Cliquez sur la croix d’une chip pour retirer la colonne",
      "Le tableau ET l’export suivent votre sélection",
    ],
  },
  {
    icon: Upload,
    title: "4 · Exporter",
    body: "Le bouton « Exporter » génère un fichier CSV, JSON ou Excel contenant exactement ce que vous voyez : colonnes sélectionnées, filtrées par la recherche courante.",
    tips: [
      "CSV et JSON supportent les très gros volumes",
      "Excel convient aux tailles modérées (~1 million de lignes max)",
    ],
  },
  {
    icon: GitMerge,
    title: "5 · Fusionner / nettoyer",
    body: "Le bouton « Fusionner / nettoyer » de la barre latérale combine vos données : empiler des fichiers de mêmes colonnes, joindre deux jeux sur une clé commune, ou supprimer les doublons.",
    tips: [
      "Les formats se mélangent : un CSV s’empile avec un JSON ou une table SQLite",
      "Le résultat est un nouveau jeu de données — les sources restent intactes",
    ],
  },
  {
    icon: RefreshCw,
    title: "6 · Rester synchronisé",
    body: "L’application surveille vos fichiers sources : un fichier modifié sur le disque est marqué « Modifié » avec un bouton Resynchroniser ; un fichier supprimé est retiré automatiquement.",
    tips: [
      "Renommez ou supprimez un jeu via le menu ⋯ de sa carte",
      "Une bannière vous prévient quand une mise à jour de l’app est disponible",
    ],
  },
];

export default function TutorialDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function close() {
    onOpenChange(false);
    setStep(0);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setStep(0);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 grid size-12 place-items-center rounded-xl border border-secondary/40 bg-secondary/10 text-secondary">
            <s.icon className="size-6" />
          </div>
          <DialogTitle className="text-center">{s.title}</DialogTitle>
          <DialogDescription className="text-center">{s.body}</DialogDescription>
        </DialogHeader>

        {s.tips && (
          <ul className="space-y-1.5 rounded-lg border bg-muted/40 px-3.5 py-3">
            {s.tips.map((t) => (
              <li
                key={t}
                className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1 size-1 shrink-0 rounded-full bg-secondary" />
                {t}
              </li>
            ))}
          </ul>
        )}

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Étape ${i + 1}`}
              className={cn(
                "size-1.5 cursor-pointer rounded-full transition-colors",
                i === step ? "w-4 bg-secondary" : "bg-border hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
            Passer
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                Précédent
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? close() : setStep(step + 1))}>
              {last ? "Terminer" : "Suivant"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
