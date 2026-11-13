import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them like app code.
  transpilePackages: [
    "@heartroom/engine",
    "@heartroom/bingo",
    "@heartroom/ui",
    "@heartroom/protocol",
    "@heartroom/db",
  ],
  // PGlite loads its WebAssembly next to its own files; bundling it would break those paths.
  serverExternalPackages: ["@electric-sql/pglite"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
