import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output, bundled inside the Electron app.
  output: "standalone",
  // Native module: load from node_modules at runtime, don't bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
