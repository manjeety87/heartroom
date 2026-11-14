import { liveRoomsResponse } from "@heartroom/protocol";
import { callGameServer, getAdmin, notFound, PRIVATE } from "@/lib/admin/server";

/** Live rooms, polled by the admin page. Non-admins get a 404, as if the route didn't exist. */
export async function GET(): Promise<Response> {
  if ((await getAdmin()) === null) return notFound();
  const answer = await callGameServer("/internal/rooms", { method: "GET" });
  const parsed = answer?.ok === true ? liveRoomsResponse.safeParse(await answer.json()) : null;
  if (parsed?.success !== true) {
    console.error("admin_rooms_failed", answer?.status ?? "unreachable");
    return Response.json({ error: "GAME_SERVER_UNREACHABLE" }, { status: 502, headers: PRIVATE });
  }
  return Response.json(parsed.data, { headers: PRIVATE });
}
