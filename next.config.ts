import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output, bundled inside the Electron app.
  output: "standalone",
  // Native module: load from node_modules at runtime, don't bundle it.
  // NOTE: the production build MUST use webpack (`next build --webpack`, see
  // package.json). With Turbopack, `serverExternalPackages` externals are emitted
  // with a hashed require id (e.g. `better-sqlite3-<hash>`) that doesn't resolve
  // in the standalone output → the server 500s ("Cannot find module …-<hash>").
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
