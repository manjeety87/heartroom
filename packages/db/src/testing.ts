import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./client.ts";
import * as schema from "./schema.ts";

/** This package's reviewed SQL migrations. */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * A fresh, migrated, in-memory Postgres for one test file: real SQL (constraints, transactions,
 * conflicts) without a server. Close it in `afterAll` with the returned `close`.
 */
export async function openTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, close: () => client.close() };
}
