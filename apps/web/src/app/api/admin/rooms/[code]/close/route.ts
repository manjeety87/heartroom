import { roomCodeInput } from "@heartroom/protocol";
import { headers } from "next/headers";
import { callGameServer, getAdmin, notFound, PRIVATE } from "@/lib/admin/server";

/**
 * Closes a live room for everyone. Only from this site's own pages: a request from another origin is
 * refused before anything else (the session cookie is SameSite=Lax, this is a second lock).
 */
export async function POST(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly code: string }> },
): Promise<Response> {
  const sent = await headers();
  const origin = sent.get("origin");
  if (origin !== null && new URL(origin).host !== sent.get("host")) return notFound();
  if ((await getAdmin()) === null) return notFound();
  const code = roomCodeInput.safeParse((await params).code);
  if (!code.success)
    return Response.json({ error: "ROOM_GONE" }, { status: 409, headers: PRIVATE });
  const answer = await callGameServer(`/internal/rooms/${code.data}/close`, { method: "POST" });
  if (answer?.status === 204) return new Response(null, { status: 204, headers: PRIVATE });
  // The site already knows this is an admin, so the game server's 404 means the room is gone.
  if (answer?.status === 404) {
    return Response.json({ error: "ROOM_GONE" }, { status: 409, headers: PRIVATE });
  }
  console.error("admin_close_failed", answer?.status ?? "unreachable");
  return Response.json({ error: "GAME_SERVER_UNREACHABLE" }, { status: 502, headers: PRIVATE });
}
