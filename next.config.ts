import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output, bundled inside the Electron app.
  output: "standalone",
  // Native module: load from node_modules at runtime, don't bundle it.
  // NOTE: Turbopack emits this external with a hashed require id
  // (e.g. `better-sqlite3-<hash>`) that doesn't resolve in the standalone output
  // → the server 500s ("Cannot find module …-<hash>"). scripts/prepare-standalone.mjs
  // creates alias packages that re-export the real module so require() succeeds.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
