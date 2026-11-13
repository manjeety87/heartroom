import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db =
  | ReturnType<typeof drizzlePostgres<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

/**
 * A deployed app talks to Neon through the pooled URL. `prepare: false` because the pooler (PgBouncer
 * in transaction mode) can't keep prepared statements; a small pool because Vercel runs many copies.
 * Migrations are not run here: `pnpm db:migrate` applies them before a deploy (backend.md › Database).
 */
export function connectPostgres(url: string): Db {
  return drizzlePostgres(postgres(url, { max: 5, prepare: false }), { schema });
}

/**
 * Local development and tests need no Neon account: PGlite is Postgres compiled to WebAssembly, kept
 * in a folder (`dataDir`) or in memory (`undefined`). It is migrated on open, so a fresh laptop works
 * after `pnpm install`. Only one process may open a folder at a time.
 * `migrationsDir` is this package's `drizzle` folder; the caller passes it because bundlers (Next's
 * Turbopack) can't resolve a folder from `import.meta.url`.
 */
export async function openLocal(options: {
  readonly dataDir: string | undefined;
  readonly migrationsDir: string;
}): Promise<Db> {
  if (options.dataDir !== undefined) mkdirSync(options.dataDir, { recursive: true });
  const db = drizzlePglite(new PGlite(options.dataDir), { schema });
  await migratePglite(db, { migrationsFolder: options.migrationsDir });
  return db;
}
