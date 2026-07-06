# DB Interface

A local, single-user app to **open, browse, filter and export your local data files** —
CSV, TSV, JSON, XLSX, plain text, SQLite databases and `.sql` scripts — entirely
offline on your machine. Runs in the browser during development and ships as a
cross-platform desktop app (Electron).

Built with Next.js (App Router) + React + Tailwind/shadcn, backed by an embedded
SQLite store (`better-sqlite3`).

## Features

- **Open local files** through a built-in file browser (the server runs locally and
  reads your filesystem): CSV, TSV, JSON, XLSX, text.
- **SQLite databases** (`.db` / `.sqlite`): every table becomes a browsable dataset,
  grouped under a single database card with a table switcher.
- **`.sql` scripts**: executed into an in-memory SQLite engine. Data-only dumps
  (e.g. Mockaroo `INSERT INTO …`) **auto-create their tables**; incompatible
  PostgreSQL/MySQL dumps are rejected with a clear message.
- **Data grid** (TanStack Table): server-side pagination, sort, full-text filter,
  resizable columns.
- **Column selection**: choose which columns to show/export via the Columns menu +
  removable chips.
- **Export** the current view (respecting the filter and selected columns) to CSV,
  JSON or XLSX.
- **Source reconciliation**: a renamed/deleted source file is dropped; a changed file
  is flagged *Modified* with one-click **Resync**.
- Rename / delete datasets, light & dark theme.

Everything stays local. The internal store lives in `./.data` (dev) or the OS
user-data folder (packaged app). **Original source files are never modified.**

## Requirements

- Node.js 22+ (developed on Node 24 / 26).

## Develop

```bash
npm install
npm run dev            # web app → http://localhost:3000
```

Run it as a **native desktop window** in development:

```bash
npm run electron:dev   # starts next dev + opens the Electron window
```

Other scripts: `npm run build` (Next production build), `npm run lint`.

## Package the desktop app

```bash
npm run electron:build   # next build → prepare standalone → electron-builder
```

Produces installers under `release/` for the current OS (macOS `.dmg`/`.zip`,
Windows `.exe`, Linux `.AppImage`/`.deb`). Config is in
[`electron-builder.yml`](electron-builder.yml).

> **Native module:** the app uses `better-sqlite3`.
> [`scripts/prepare-standalone.mjs`](scripts/prepare-standalone.mjs) downloads the
> prebuilt binary matching Electron's Node ABI (no local compilation), and
> [`scripts/after-pack.cjs`](scripts/after-pack.cjs) bundles the Next standalone
> server into the app.

### CI

The most reliable way to build installers is in a clean CI runner:

- **GitLab** — [`.gitlab-ci.yml`](.gitlab-ci.yml) builds the Linux installers on the
  shared runners (run manually from *CI/CD → Pipelines → Run pipeline*, or push a
  `v*` tag). macOS/Windows installers need macOS/Windows runners.
- **GitHub** (if you mirror the repo) — [`.github/workflows/build-desktop.yml`](.github/workflows/build-desktop.yml)
  builds macOS, Windows and Linux on GitHub's free runners.

## Tech stack

Next.js 16 (App Router, standalone output) · React 19 · TypeScript · Tailwind CSS 4 +
shadcn/ui (Base UI) · better-sqlite3 · papaparse · SheetJS (xlsx) · TanStack Table +
Virtual · SWR · Electron 42 + electron-builder.

## Project layout

- `app/` — UI shell + API route handlers (`app/api/**`).
- `lib/` — data layer: parsing, SQLite store, reconciliation, export.
- `components/` — React components (grid, sidebar, dialogs…) and `components/ui` (shadcn).
- `electron/` — Electron main process · `scripts/` — packaging helpers.
