// electron-builder afterPack hook.
// Copies the prepared Next standalone server (with its node_modules + the
// Electron-ABI better-sqlite3 binary) into the app's resources AFTER
// electron-builder's own file processing, so its node_modules aren't stripped.
const { cpSync, existsSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const product = packager.appInfo.productFilename;
  const isMac = electronPlatformName === "darwin";
  const appPath = isMac ? path.join(appOutDir, `${product}.app`) : null;
  const resources = isMac
    ? path.join(appPath, "Contents", "Resources")
    : path.join(appOutDir, "resources");

  const src = path.join(process.cwd(), ".next", "standalone");
  if (!existsSync(path.join(src, "server.js"))) {
    throw new Error(
      "afterPack: .next/standalone not prepared — run scripts/prepare-standalone.mjs first.",
    );
  }
  // verbatimSymlinks keeps relative in-bundle symlinks as-is; without it cpSync
  // rewrites them to absolute build-machine paths (dead on the user's machine +
  // rejected by codesign → invalid signature → no launch on Apple Silicon).
  cpSync(src, path.join(resources, "standalone"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  console.log("afterPack: bundled standalone server into", resources);

  // Copying files into the bundle after packaging invalidates its code
  // signature. Apple Silicon REFUSES to launch an app whose signature is
  // invalid (Gatekeeper bypass / xattr doesn't help — it's not quarantine).
  // Re-sign the whole bundle ad-hoc (free, no Apple Developer cert) so it
  // covers the added standalone server + its native better-sqlite3 binary.
  if (isMac) {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
      stdio: "inherit",
    });
    console.log("afterPack: ad-hoc re-signed", appPath);
  }
};
