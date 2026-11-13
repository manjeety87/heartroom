import { defineConfig } from "drizzle-kit";

/**
 * `pnpm --filter @heartroom/db generate` writes reviewed SQL into ./drizzle (commit it).
 * `migrate` applies it to the direct (non-pooler) Neon URL; it never runs `push`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  ...(process.env["DATABASE_URL_DIRECT"]
    ? { dbCredentials: { url: process.env["DATABASE_URL_DIRECT"] } }
    : {}),
});
