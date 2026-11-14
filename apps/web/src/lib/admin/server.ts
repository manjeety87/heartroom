import { schema } from "@heartroom/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { getAuth, getDb } from "@/lib/auth/server";

/**
 * Server-only. Who may see /admin: the signed-in person whose `user.is_admin` is true, read from the
 * database on every request (the session and the game token carry no admin claim). Anyone else is
 * treated as if /admin didn't exist (404), by the pages and their API routes alike.
 */
export async function getAdmin(): Promise<{ readonly userId: string } | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session === null || session.user.isAnonymous === true) return null;
  const [row] = await getDb()
    .select({ isAdmin: schema.user.isAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id))
    .limit(1);
  return row?.isAdmin === true ? { userId: session.user.id } : null;
}

/** `KEY=` in a .env file means "unset". */
const gameServerUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url({ protocol: /^https?$/ }).optional(),
);

/**
 * The game server's HTTP address as seen from the site's server (`GAME_SERVER_HTTP_URL`). Unset off
 * Vercel → the dev server on this machine; on Vercel it must be set, or the admin page says so.
 */
function gameServerBase(): string | null {
  const parsed = gameServerUrl.safeParse(process.env["GAME_SERVER_HTTP_URL"]);
  if (!parsed.success) return null;
  if (parsed.data !== undefined) return parsed.data;
  return process.env["VERCEL"] === undefined ? "http://localhost:2567" : null;
}

/**
 * Calls one of the game server's `/internal` routes as this admin, with their own short game token
 * (the server checks `is_admin` again). Null when the game server can't be reached at all.
 */
export async function callGameServer(
  path: `/internal/${string}`,
  init: { readonly method: "GET" | "POST" },
): Promise<Response | null> {
  const base = gameServerBase();
  if (base === null) return null;
  const { token } = await getAuth().api.getToken({ headers: await headers() });
  try {
    return await fetch(new URL(path, base), {
      method: init.method,
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return null;
  }
}

/** Admin answers are never cached anywhere but the browser that asked. */
export const PRIVATE = { "cache-control": "private, no-store" } as const;

export const notFound = () => new Response(null, { status: 404, headers: PRIVATE });
