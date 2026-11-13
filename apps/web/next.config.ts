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
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
