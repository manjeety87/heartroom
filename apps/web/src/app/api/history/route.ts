import { headers } from "next/headers";
import { getAuth, getDb } from "@/lib/auth/server";
import { NO_HISTORY } from "@/lib/history/online";
import { readOnlineHistory } from "@/lib/history/query";

/** Personal data: never cached anywhere but the browser that asked. */
const PRIVATE = { "cache-control": "private, no-store" };

/** The caller's own online games. No session (never played online) means no games, not an error. */
export async function GET(): Promise<Response> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session === null) return Response.json(NO_HISTORY, { headers: PRIVATE });
  try {
    return Response.json(await readOnlineHistory(getDb(), session.user.id), { headers: PRIVATE });
  } catch (error) {
    console.error("history_read_failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "INTERNAL" }, { status: 500, headers: PRIVATE });
  }
}
