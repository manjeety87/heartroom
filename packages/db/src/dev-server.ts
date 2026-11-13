import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_DIR } from "./testing.ts";

/**
 * `pnpm dev` (or `pnpm --filter @heartroom/db dev`): the local database for development. PGlite keeps
 * its files in `<repo>/.data/pglite` (git-ignored), applies any new migration on start, and serves
 * the Postgres protocol on 127.0.0.1:5433 so the site and the game server connect to it like Neon.
 * Delete `.data/pglite` to start from an empty database.
 */
const PORT = 5433;
const dataDir = fileURLToPath(new URL("../../../.data/pglite", import.meta.url));
mkdirSync(dataDir, { recursive: true });

const pglite = new PGlite(dataDir);
await migrate(drizzle(pglite), { migrationsFolder: MIGRATIONS_DIR });

// Several connections share one database; PGlite runs their queries one at a time and keeps a
// transaction to the connection that opened it.
const server = new PGLiteSocketServer({ db: pglite, port: PORT, maxConnections: 20 });
await server.start();
console.log(`Local database ready on 127.0.0.1:${String(PORT)} (data in .data/pglite)`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server
      .stop()
      .then(() => pglite.close())
      .finally(() => process.exit(0));
  });
}
