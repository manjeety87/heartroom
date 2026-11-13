import { z } from "zod";
import { ERROR_CODES } from "./errors.ts";
import { nicknameProblem } from "./nickname-filter.ts";
import { SEAT_COLOR_IDS } from "./seat-colors.ts";

/**
 * Every message between browser and game server. Each one is `safeParse`d on arrival; invalid
 * messages are dropped. Schemas are strict and every string and array is bounded. Wire `type`
 * values are snake_case. Additive changes only: add optional fields, never change existing ones.
 */

export const LIMITS = {
  /** Largest WebSocket payload a browser may send, in bytes. */
  MESSAGE_BYTES: 8 * 1024,
  /** A sealed checkpoint (base64url); it reaches the server only inside create/join options (HTTP). */
  CHECKPOINT_CHARS: 64 * 1024,
  ID_CHARS: 64,
  NICKNAME_CHARS: 20,
  MAX_SEATS: 6,
  MAX_SPECTATORS: 50,
} as const;

const id = z.string().min(1).max(LIMITS.ID_CHARS);
const nickname = z.string().min(1).max(LIMITS.NICKNAME_CHARS);

/**
 * What a person types as their name: trimmed, inner spaces collapsed, NFC-normalised (so "é" typed
 * two ways is one name), then 1–20 characters with at least one letter or digit, and nothing the
 * name filter blocks or reserves. Uniqueness is per room and is decided by the server on join.
 */
export const nicknameInput = z
  .string()
  .transform((s) => s.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Type a name.")
      .max(LIMITS.NICKNAME_CHARS, `Keep it to ${String(LIMITS.NICKNAME_CHARS)} characters.`)
      .regex(/[\p{L}\p{N}]/u, "Use at least one letter or number.")
      .superRefine((name, ctx) => {
        const problem = nicknameProblem(name);
        if (problem === null) return;
        ctx.addIssue({
          code: "custom",
          message:
            problem === "blocked"
              ? "Pick a friendlier name."
              : "That name is reserved. Pick another.",
        });
      }),
  );
const seq = z.number().int().nonnegative();

// ── client → server ─────────────────────────────────────────────────────────────────────────────

/** `action` is parsed later by the game's own `actionSchema`, so it stays opaque here. */
export const intentMessage = z.strictObject({
  type: z.literal("intent"),
  clientActionId: id,
  turnSeq: seq,
  action: z.unknown(),
});

export const resyncMessage = z.strictObject({ type: z.literal("resync") });

const hostCommand = <K extends string>(kind: K) =>
  z.strictObject({ type: z.literal("host"), kind: z.literal(kind) });
const hostTargetCommand = <K extends string>(kind: K) =>
  z.strictObject({ type: z.literal("host"), kind: z.literal(kind), target: id });

/** Host powers. The server checks `hostId` for every one; `target` is a user or knock id. */
export const hostMessage = z.discriminatedUnion("kind", [
  hostCommand("start"),
  // The game's own `configSchema` parses `config` once the room knows which game it is for.
  z.strictObject({
    type: z.literal("host"),
    kind: z.literal("config"),
    gameId: id,
    config: z.unknown(),
  }),
  hostCommand("lock"),
  hostCommand("unlock"),
  hostCommand("new_code"),
  hostTargetCommand("mute"),
  hostTargetCommand("block_mic"),
  hostTargetCommand("unblock_mic"),
  hostTargetCommand("kick"),
  hostTargetCommand("accept_knock"),
  hostTargetCommand("deny_knock"),
]);

/**
 * Whether the room is on screen (the Page Visibility API), sent when it changes. A hidden tab counts
 * as away for an "away only" clock, and a spectator hidden for 3 minutes leaves voice.
 */
export const presenceMessage = z.strictObject({
  type: z.literal("presence"),
  isVisible: z.boolean(),
});

export const voiceTokenRequest = z.strictObject({ type: z.literal("voice_token") });
export const rematchReadyMessage = z.strictObject({ type: z.literal("rematch_ready") });

export const clientMessage = z.union([
  intentMessage,
  resyncMessage,
  hostMessage,
  voiceTokenRequest,
  rematchReadyMessage,
  presenceMessage,
]);

export type ClientMessage = z.infer<typeof clientMessage>;
export type HostMessage = z.infer<typeof hostMessage>;
export type HostCommandKind = HostMessage["kind"];

/**
 * What a browser sends with `create` / `joinById`. Who the person is comes from the auth token, never
 * from here; the colour is a wish, and the server gives the next free one if it is taken.
 */
export const joinOptions = z.strictObject({
  nickname: nicknameInput,
  color: z.enum(SEAT_COLOR_IDS).optional(),
  /**
   * The last sealed checkpoint this browser got from the room, sent when the room may have been lost
   * to a server restart. The server ignores it when the room is alive.
   */
  resume: z.string().min(1).max(LIMITS.CHECKPOINT_CHARS).optional(),
});

export type JoinOptions = z.input<typeof joinOptions>;

// ── server → client ─────────────────────────────────────────────────────────────────────────────

export const ROOM_PHASES = ["lobby", "setup", "playing", "results"] as const;
export type RoomPhase = (typeof ROOM_PHASES)[number];

const seatInfo = z.strictObject({
  seat: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.MAX_SEATS - 1),
  userId: id.nullable(),
  nickname: nickname.nullable(),
  isConnected: z.boolean(),
  /** Unique within the room; absent for an empty seat. */
  color: z.enum(SEAT_COLOR_IDS).optional(),
});

/** Public room facts, sent in full on every change. Never game state. */
export const roomMessage = z.strictObject({
  type: z.literal("room"),
  code: z.string().length(6),
  hostId: id,
  isLocked: z.boolean(),
  phase: z.enum(ROOM_PHASES),
  gameId: id.nullable(),
  seats: z.array(seatInfo).max(LIMITS.MAX_SEATS),
  spectators: z.array(z.strictObject({ userId: id, nickname })).max(LIMITS.MAX_SPECTATORS),
  /**
   * Who plays the current or last game, in the game's own seat order (`view.you`, `view.turn` and
   * `callers` index this list). It differs from `seats` because the room rotates who goes first,
   * and it keeps a player who left mid-game so results can still name them. Empty before a game.
   */
  matchPlayers: z
    .array(z.strictObject({ userId: id, nickname, color: z.enum(SEAT_COLOR_IDS) }))
    .max(LIMITS.MAX_SEATS)
    .optional(),
  /**
   * The settings the host chose for the next game (`gameId`'s own config, parsed by that game's
   * UI), so every screen shows them and the host's picker survives a refresh.
   */
  gameConfig: z.unknown().optional(),
  /** Users whose mic the host has blocked: LiveKit refuses their audio, and the UI says so. */
  micBlocked: z
    .array(id)
    .max(LIMITS.MAX_SEATS + LIMITS.MAX_SPECTATORS)
    .optional(),
});

/** One viewer's `view()` after action `seq`. Views are full snapshots: the newest one wins. */
export const gameMessage = z.strictObject({
  type: z.literal("game"),
  seq,
  view: z.unknown(),
});

/**
 * The clock of the current turn, sent whenever it starts, stops or pauses. `msLeft` (not a time of
 * day) so the countdown doesn't depend on the phone's clock being right; null while the clock is
 * paused (an "away only" clock with its player present).
 */
export const deadlineMessage = z.strictObject({
  type: z.literal("deadline"),
  deadline: z
    .strictObject({
      seat: z
        .number()
        .int()
        .min(0)
        .max(LIMITS.MAX_SEATS - 1),
      key: z.string().min(1).max(64),
      msLeft: z.number().int().nullable(),
      totalMs: z.number().int().positive(),
    })
    .nullable(),
});

export const ackMessage = z.strictObject({ type: z.literal("ack"), clientActionId: id });

export const errorMessage = z.strictObject({
  type: z.literal("error"),
  code: z.enum(ERROR_CODES),
  message: z.string().max(200),
});

/**
 * Why a create/join was refused. It travels as the JSON text of the Colyseus join error's message,
 * because a refused join has no socket to send a normal message on.
 */
export const joinError = z.strictObject({
  code: z.enum(ERROR_CODES),
  message: z.string().max(200),
  /** With `NAME_TAKEN`: a free name to offer ("Riya 2"). */
  suggestion: nickname.optional(),
});

export type JoinError = z.infer<typeof joinError>;

export const voiceTokenMessage = z.strictObject({
  type: z.literal("voice_token"),
  token: z.string().min(1).max(4096),
  url: z.url({ protocol: /^wss?$/ }),
});

/**
 * The room's sealed state after its latest change, the same blob for everyone. Opaque to the browser:
 * it only keeps the newest one and hands it back to resume after a server restart.
 */
export const checkpointMessage = z.strictObject({
  type: z.literal("checkpoint"),
  checkpoint: z.string().min(1).max(LIMITS.CHECKPOINT_CHARS),
});

export const knockMessage = z.strictObject({ type: z.literal("knock"), knockId: id, nickname });

export const serverMessage = z.discriminatedUnion("type", [
  roomMessage,
  gameMessage,
  ackMessage,
  errorMessage,
  voiceTokenMessage,
  knockMessage,
  checkpointMessage,
  deadlineMessage,
]);

export type ServerMessage = z.infer<typeof serverMessage>;
export type RoomMessage = z.infer<typeof roomMessage>;
export type DeadlineMessage = z.infer<typeof deadlineMessage>;
