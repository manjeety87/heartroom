import { z } from "zod";
import { ROOM_PHASES } from "./messages.ts";
import { SEAT_COLOR_IDS } from "./seat-colors.ts";

/**
 * The game server's `GET /internal/rooms` answer, read by the site's admin page. A room carries its
 * **public** (spectator) view only, never a seat's view, a seed or a user id.
 */
export const liveRoom = z.strictObject({
  code: z.string(),
  gameId: z.string().nullable(),
  phase: z.enum(ROOM_PHASES),
  isLocked: z.boolean(),
  /** Who sits in the room, in room seat order. */
  seats: z.array(
    z.strictObject({
      nickname: z.string(),
      color: z.enum(SEAT_COLOR_IDS),
      isConnected: z.boolean(),
    }),
  ),
  /** The current/last game's players in game seat order (the room rotates seats every game). */
  gamePlayers: z.array(z.strictObject({ nickname: z.string(), color: z.enum(SEAT_COLOR_IDS) })),
  spectators: z.number().int().nonnegative(),
  /** People in the room's voice right now (open LiveKit sessions). */
  inVoice: z.number().int().nonnegative(),
  /** Epoch milliseconds. */
  createdAt: z.number(),
  lastActionAt: z.number(),
  /** Playing, with no move for twice the turn clock (or 10 min without one). */
  isStuck: z.boolean(),
  /**
   * What a spectator sees of the current or last game (null before the first one). Its own `gameId`:
   * the host may already have picked another game for the next round.
   */
  view: z.strictObject({ gameId: z.string(), state: z.unknown() }).nullable(),
});

export const liveRoomsResponse = z.strictObject({
  rooms: z.array(liveRoom),
  voice: z.strictObject({
    isEnabled: z.boolean(),
    monthMinutes: z.number().nonnegative(),
    capMinutes: z.number().int().positive().nullable(),
    isResting: z.boolean(),
  }),
  /** Since this process started (`startedAt`, epoch ms). */
  health: z.strictObject({
    startedAt: z.number(),
    reconnects: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  }),
});

export type LiveRoom = z.infer<typeof liveRoom>;
export type LiveRoomsResponse = z.infer<typeof liveRoomsResponse>;
