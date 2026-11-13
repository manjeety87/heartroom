import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/** Any Postgres connection with our schema: Neon in production, the local dev server, or PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * The local database `pnpm dev` starts (`src/dev-server.ts`): Postgres compiled to WebAssembly
 * (PGlite) behind a Postgres socket, so the site and the game server share it like a real one.
 * Used whenever `DATABASE_URL` is unset outside production. Nothing secret: it only listens on
 * this machine and holds local test data.
 */
export const DEV_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5433/postgres";

/**
 * A pooled connection. `prepare: false` because Neon's pooler (PgBouncer, transaction mode) can't
 * keep prepared statements; a small pool because Vercel runs many copies of the site. Migrations are
 * not run here: `pnpm db:migrate` applies them before a deploy (backend.md › Database).
 */
export function connectPostgres(url: string): Db {
  return drizzle(postgres(url, { max: 5, prepare: false }), { schema });
}
