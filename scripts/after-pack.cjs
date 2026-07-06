// electron-builder afterPack hook.
// Copies the prepared Next standalone server (with its node_modules + the
// Electron-ABI better-sqlite3 binary) into the app's resources AFTER
// electron-builder's own file processing, so its node_modules aren't stripped.
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const product = packager.appInfo.productFilename;
  const resources =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${product}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");

  const src = path.join(process.cwd(), ".next", "standalone");
  if (!existsSync(path.join(src, "server.js"))) {
    throw new Error(
      "afterPack: .next/standalone not prepared — run scripts/prepare-standalone.mjs first.",
    );
  }
  cpSync(src, path.join(resources, "standalone"), { recursive: true });
  console.log("afterPack: bundled standalone server into", resources);
};
