import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEV_DATABASE_URL } from "./client.ts";
import { user } from "./schema.ts";

/**
 * `pnpm --filter @heartroom/db make-admin <email> [--remove]`: gives (or takes) the admin role.
 * The only way to set `user.is_admin`; only a Google account can hold it (a guest has no email of its
 * own). Uses `DATABASE_URL_DIRECT`/`DATABASE_URL`, else the local database `pnpm dev` starts.
 */
const [email, flag] = process.argv.slice(2);
if (email === undefined || !email.includes("@") || (flag !== undefined && flag !== "--remove")) {
  console.error("Usage: pnpm --filter @heartroom/db make-admin <email> [--remove]");
  process.exit(1);
}
const isAdmin = flag === undefined;
/** `KEY=` in a .env file means "unset". */
const env = (key: string) => (process.env[key] === "" ? undefined : process.env[key]);
const url = env("DATABASE_URL_DIRECT") ?? env("DATABASE_URL") ?? DEV_DATABASE_URL;
const client = postgres(url, { max: 1 });
const db = drizzle(client);
try {
  const changed = await db
    .update(user)
    .set({ isAdmin })
    .where(and(eq(user.email, email.toLowerCase()), eq(user.isAnonymous, false)))
    .returning({ id: user.id });
  if (changed.length === 0) {
    console.error("No Google account with that email. Sign in with Google on the site first.");
    process.exitCode = 1;
  } else {
    console.log(isAdmin ? "Admin role given." : "Admin role removed.");
  }
} finally {
  await client.end();
}
