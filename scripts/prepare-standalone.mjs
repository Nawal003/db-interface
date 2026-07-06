// Prepares .next/standalone to be bundled inside the Electron app:
//  1) copies static assets + public/ next to the standalone server
//  2) swaps better-sqlite3's native binary for one matching Electron's ABI
//     (downloaded prebuilt — no local compilation needed)
import { cpSync, existsSync } from "node:fs";
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

console.log("prepare-standalone: done.");
