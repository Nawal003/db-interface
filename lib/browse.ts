import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectFormat } from "./parse";

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  supported: boolean;
  size: number;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  home: string;
  entries: FsEntry[];
}

/** List a local directory: subfolders + supported data files (dotfiles hidden). */
export function browseDir(dirPath?: string): BrowseResult {
  const home = os.homedir();
  const target = path.resolve(dirPath && dirPath.trim() ? dirPath : home);

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) throw new Error("Not a directory: " + target);

  const dirents = fs.readdirSync(target, { withFileTypes: true });
  const entries: FsEntry[] = [];
  for (const d of dirents) {
    if (d.name.startsWith(".")) continue; // hide dotfiles
    const full = path.join(target, d.name);
    let isDir = d.isDirectory();
    let size = 0;
    if (d.isSymbolicLink()) {
      try {
        const s = fs.statSync(full);
        isDir = s.isDirectory();
        size = s.size;
      } catch {
        continue; // broken symlink
      }
    } else if (!isDir) {
      try {
        size = fs.statSync(full).size;
      } catch {
        size = 0;
      }
    }
    const supported = !isDir && detectFormat(d.name) !== null;
    if (!isDir && !supported) continue; // only show importable files
    entries.push({ name: d.name, path: full, isDir, supported, size });
  }

  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const parent = path.dirname(target);
  return {
    path: target,
    parent: parent === target ? null : parent,
    home,
    entries,
  };
}
