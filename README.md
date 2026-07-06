<div align="center">

# 🗂️ DB Interface

**Ouvrez, explorez et exportez vos fichiers de données locaux — CSV, JSON, Excel, SQLite… — 100 % hors ligne.**

![Electron](https://img.shields.io/badge/Electron-2B2E3A?logo=electron&logoColor=9FEAF9)
![Next.js 16](https://img.shields.io/badge/Next.js%2016-000000?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React%2019-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![100% hors ligne](https://img.shields.io/badge/100%25-hors%20ligne-2ea44f)

</div>

---

**DB Interface** transforme n'importe quel fichier de données de votre ordinateur en un
**tableau clair, cherchable, triable et exportable**. Aucun cloud, aucun compte, aucune
connexion réseau : vos fichiers ne quittent jamais votre machine.

C'est une application **desktop** (macOS · Windows · Linux) qui tourne aussi dans le
navigateur en développement.

## ✨ Fonctionnalités

- 📁 **Ouvre vos fichiers locaux** via un explorateur intégré : `.csv`, `.tsv`, `.json`, `.xlsx`, texte.
- 🗄️ **Bases SQLite** (`.db` / `.sqlite`) : chaque table devient un jeu de données navigable, regroupé sous une seule carte de base avec un sélecteur de tables.
- 📜 **Scripts `.sql`** : exécutés dans un moteur SQLite en mémoire. Les dumps de données (ex. `INSERT INTO …` de Mockaroo) **créent automatiquement leurs tables**.
- 🔎 **Recherche** plein-texte, **tri** par colonne et **pagination** des gros fichiers.
- ↔️ **Colonnes redimensionnables** au glisser.
- 🎯 **Sélection de colonnes** : affichez/masquez les colonnes ; celles retenues s'affichent en **chips** amovibles.
- 📤 **Export** en **CSV**, **JSON** ou **Excel** — exactement ce que vous voyez (colonnes choisies + filtre courant).
- 🔄 **Synchronisation** : un fichier source renommé/supprimé est retiré ; un fichier modifié est signalé **Modifié**, avec **Resynchroniser** en un clic.
- 🌗 **Thème clair / sombre**, interface **entièrement en français**.

> 🔒 Vos **fichiers d'origine ne sont jamais modifiés** — DB Interface se contente de les lire et garde sa propre copie.

## 📂 Formats supportés

| Type | Extensions | Résultat |
|------|-----------|----------|
| Tableurs texte | `.csv`, `.tsv` | 1 jeu de données |
| JSON | `.json` | 1 jeu de données |
| Excel | `.xlsx` | 1 jeu de données |
| Texte brut | `.txt`, `.log`, `.md` | 1 jeu de données |
| Base SQLite | `.db`, `.sqlite`, `.sqlite3` | 1 carte, 1 jeu par table |
| Script SQL | `.sql` | 1 carte, 1 jeu par table |

## 🚀 Utilisation

### 1. Importer une source
Cliquez sur **Importer un fichier** dans la barre latérale. L'explorateur de fichiers
s'ouvre : naviguez dans vos dossiers et choisissez un fichier. Il est copié dans l'app
et apparaît sous forme de **carte de jeu de données**.

- Un **fichier** (CSV / JSON / …) → un jeu de données.
- Une **base SQLite** ou un **script `.sql`** → une carte de base, avec un **sélecteur de tables** pour passer de l'une à l'autre.

### 2. Explorer
Sélectionnez un jeu de données pour ouvrir son tableau :

- 🔎 **Rechercher** dans toutes les colonnes depuis la barre de recherche.
- ↕️ **Trier** en cliquant sur un en-tête de colonne.
- ↔️ **Redimensionner** une colonne en tirant sur son bord.
- 📑 **Paginer** à travers les grands fichiers.

### 3. Choisir ses colonnes
Le bouton **Colonnes** ouvre la liste des champs à afficher ou masquer. Les colonnes
retenues apparaissent en **chips** sous la barre de recherche (croix pour les enlever).
Le tableau **et l'export** suivent votre sélection.

### 4. Exporter
Bouton **Exporter** → **CSV**, **JSON** ou **Excel**. Le fichier généré contient
exactement ce que vous voyez : vos colonnes sélectionnées, dans l'ordre, filtrées par la
recherche courante.

### 5. Rester synchronisé
DB Interface surveille vos fichiers sources :

- Renommé ou supprimé sur le disque → le jeu de données est retiré automatiquement.
- Modifié sur le disque → il est marqué **Modifié** ; cliquez sur **Resynchroniser** pour le recharger.

Vous pouvez aussi **renommer** ou **supprimer** un jeu de données depuis le menu **⋯** de sa carte.

## 💻 Lancer l'application

### Version desktop (recommandé)
Téléchargez l'installeur de votre OS depuis la page
[**Releases**](https://github.com/Nawal003/de-interface/releases) (ou construisez-le,
voir ci-dessous), puis lancez **DB Interface**.

> Sur macOS, l'app n'étant pas signée, au premier lancement faites **clic droit → Ouvrir**
> (ou `xattr -dr com.apple.quarantine "DB Interface.app"`).

### Depuis les sources
```bash
npm install
npm run electron:dev   # fenêtre desktop native
# ou
npm run dev            # dans le navigateur → http://localhost:3000
```

*Prérequis : Node.js 22+.*

## 📦 Construire les installeurs

```bash
npm run electron:build   # → dossier release/  (.dmg / .exe / .AppImage / .deb selon l'OS)
```

Chaque installeur se construit **sur l'OS correspondant**. Pour les produire tous
automatiquement :

- **GitHub Actions** — [`.github/workflows/build-desktop.yml`](.github/workflows/build-desktop.yml) construit macOS, Windows **et** Linux sur les runners gratuits (onglet *Actions → Run workflow*, ou en poussant un tag `v*`).
- **GitLab CI** — [`.gitlab-ci.yml`](.gitlab-ci.yml) construit les installeurs Linux sur les runners partagés.

## 🔒 Confidentialité

100 % local et hors ligne. Aucune télémétrie, aucun appel réseau, aucun compte. Le
stockage interne vit dans `./.data` (dev) ou le dossier de données utilisateur de l'OS
(app packagée). Vos données restent sur votre machine.

## 🛠️ Stack technique

Next.js 16 (App Router, sortie standalone) · React 19 · TypeScript · Tailwind CSS 4 +
shadcn/ui (Base UI) · better-sqlite3 · papaparse · SheetJS (xlsx) · TanStack Table ·
SWR · Electron + electron-builder.

## 📁 Structure du projet

| Dossier | Rôle |
|---------|------|
| `app/` | Interface + routes API (`app/api/**`) |
| `lib/` | Couche données : parsing, store SQLite, réconciliation, export |
| `components/` | Composants React (grille, sidebar, dialogues…) + `components/ui` (shadcn) |
| `electron/` | Processus principal Electron |
| `scripts/` | Utilitaires d'empaquetage |
