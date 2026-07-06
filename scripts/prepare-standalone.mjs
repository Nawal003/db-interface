// Prepares .next/standalone to be bundled inside the Electron app:
//  1) copies static assets + public/ next to the standalone server
//  2) swaps better-sqlite3's native binary for one matching Electron's ABI
//     (downloaded prebuilt — no local compilation needed)
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("Missing .next/standalone — run `next build` first.");
  process.exit(1);
}

// 1) Static assets the standalone server serves.
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
}

// 2) Native binary for Electron's Node ABI (prebuilt, per current platform).
//    SQLITE_TARGET_ARCH overrides the arch so CI can cross-build (e.g. fetch the
//    x64 binary on an Apple-Silicon runner to package an Intel .dmg).
const electronVersion = require("electron/package.json").version;
const targetArch = process.env.SQLITE_TARGET_ARCH || process.arch;
const bs3 = join(standalone, "node_modules", "better-sqlite3");
const prebuildInstall = require.resolve("prebuild-install/bin.js");

console.log(
  `Fetching better-sqlite3 prebuild for Electron ${electronVersion} ` +
    `(${process.platform}-${targetArch})…`,
);
execFileSync(
  process.execPath,
  [
    prebuildInstall,
    "--runtime",
    "electron",
    "--target",
    electronVersion,
    "--arch",
    targetArch,
    "--platform",
    process.platform,
    "--tag-prefix",
    "v",
  ],
  { cwd: bs3, stdio: "inherit" },
);

// 3) Turbopack externalizes serverExternalPackages under a hashed require id
//    (e.g. `require("better-sqlite3-90e2652d1716b047")`) that doesn't resolve at
//    runtime → the standalone server 500s. Scan the built server chunks for those
//    hashed ids and drop a tiny alias package that re-exports the real module.
const EXTERNALS = ["better-sqlite3"];
const serverDir = join(standalone, ".next", "server");
const aliases = new Map(); // hashedName -> realPackage

function scanForAliases(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForAliases(full);
    } else if (entry.name.endsWith(".js")) {
      const text = readFileSync(full, "utf8");
      for (const pkg of EXTERNALS) {
        const re = new RegExp(
          pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-[a-f0-9]{6,}",
          "g",
        );
        for (const hashed of text.match(re) ?? []) aliases.set(hashed, pkg);
      }
    }
  }
}

if (existsSync(serverDir)) scanForAliases(serverDir);
for (const [hashed, pkg] of aliases) {
  const dir = join(standalone, "node_modules", hashed);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: hashed, version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(dir, "index.js"), `module.exports = require(${JSON.stringify(pkg)});\n`);
  console.log(`Aliased external ${hashed} -> ${pkg}`);
}

console.log("prepare-standalone: done.");
