import { createEndpoint } from "@colyseus/core";
import { schema, type Db } from "@heartroom/db";
import { roomCodeInput, type LiveRoomsResponse } from "@heartroom/protocol";
import { count, eq, isNull } from "drizzle-orm";
import type { VerifyToken } from "../auth/verify-token.ts";
import type { Logger } from "../logger.ts";
import { health, liveRooms } from "./live-rooms.ts";

/** The database side of the admin routes. */
export type AdminStore = {
  isAdmin(userId: string): Promise<boolean>;
  /** Written before the action runs, so an action that crashes halfway is still on record. */
  audit(adminId: string, action: "close_room", target: string): Promise<void>;
  /** Open voice sessions per room uid. */
  inVoice(): Promise<ReadonlyMap<string, number>>;
};

export function createAdminStore(db: Db): AdminStore {
  const { user, adminAudit, voiceUsage } = schema;
  return {
    async isAdmin(userId) {
      const [row] = await db
        .select({ isAdmin: user.isAdmin })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return row?.isAdmin === true;
    },
    async audit(adminId, action, target) {
      await db.insert(adminAudit).values({ adminId, action, target });
    },
    async inVoice() {
      const rows = await db
        .select({ roomId: voiceUsage.roomId, people: count() })
        .from(voiceUsage)
        .where(isNull(voiceUsage.leftAt))
        .groupBy(voiceUsage.roomId);
      return new Map(rows.map((r) => [r.roomId, r.people]));
    },
  };
}

export type AdminApiDeps = {
  readonly verifyToken: VerifyToken;
  readonly store: AdminStore;
  readonly voice: () => LiveRoomsResponse["voice"];
  readonly log: Logger;
  readonly now?: () => number;
};

const NOT_FOUND = () => new Response(null, { status: 404 });
const PRIVATE = { "cache-control": "no-store" };

/**
 * `GET /internal/rooms` and `POST /internal/rooms/:code/close`, for the site's admin page only. The
 * caller sends its game token; the database must say `is_admin` on every request (the token carries
 * no admin claim). Anyone else, a bad token included, gets the same 404 as a route that isn't there.
 */
export function createAdminApi(deps: AdminApiDeps) {
  const now = deps.now ?? Date.now;

  async function adminOf(authorization: string | null): Promise<string | null> {
    const token = /^Bearer (\S+)$/.exec(authorization ?? "")?.[1];
    const identity = await deps.verifyToken(token);
    if (identity === null) return null;
    return (await deps.store.isAdmin(identity.userId)) ? identity.userId : null;
  }

  async function guarded(task: () => Promise<Response>): Promise<Response> {
    try {
      return await task();
    } catch (error) {
      health.failed();
      deps.log.error({ event: "admin_route_failed", err: error }, "admin_route_failed");
      return new Response(null, { status: 500 });
    }
  }

  return {
    listRooms: (authorization: string | null) =>
      guarded(async () => {
        if ((await adminOf(authorization)) === null) return NOT_FOUND();
        const inVoice = await deps.store.inVoice();
        const at = now();
        const body: LiveRoomsResponse = {
          rooms: liveRooms
            .entries()
            .map(([uid, room]) => ({ ...room.summary(at), inVoice: inVoice.get(uid) ?? 0 }))
            .sort((a, b) => b.lastActionAt - a.lastActionAt),
          voice: deps.voice(),
          health: health.read(),
        };
        return Response.json(body, { headers: PRIVATE });
      }),

    closeRoom: (authorization: string | null, rawCode: string) =>
      guarded(async () => {
        const adminId = await adminOf(authorization);
        if (adminId === null) return NOT_FOUND();
        const code = roomCodeInput.safeParse(rawCode);
        const found = code.success
          ? liveRooms.entries().find(([, room]) => room.code() === code.data)
          : undefined;
        if (found === undefined) return NOT_FOUND();
        const [roomUid, room] = found;
        await deps.store.audit(adminId, "close_room", roomUid);
        room.close();
        deps.log.info({ event: "admin_closed_room", adminId, roomUid }, "admin_closed_room");
        return new Response(null, { status: 204 });
      }),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;

export function adminEndpoints(api: AdminApi) {
  return {
    adminRooms: createEndpoint("/internal/rooms", { method: "GET", requireRequest: true }, (ctx) =>
      api.listRooms(ctx.request.headers.get("authorization")),
    ),
    adminCloseRoom: createEndpoint(
      "/internal/rooms/:code/close",
      { method: "POST", disableBody: true, requireRequest: true },
      (ctx) => api.closeRoom(ctx.request.headers.get("authorization"), ctx.params.code),
    ),
  };
}
