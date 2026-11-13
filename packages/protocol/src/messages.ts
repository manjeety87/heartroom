import { z } from "zod";
import { ERROR_CODES } from "./errors.ts";
import { SEAT_COLOR_IDS } from "./seat-colors.ts";

/**
 * Every message between browser and game server. Each one is `safeParse`d on arrival; invalid
 * messages are dropped. Schemas are strict and every string and array is bounded. Wire `type`
 * values are snake_case. Additive changes only: add optional fields, never change existing ones.
 */

export const LIMITS = {
  /** Largest WebSocket payload in bytes, except `resume`. */
  MESSAGE_BYTES: 8 * 1024,
  /** A sealed checkpoint (base64url) is the one larger payload. */
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
 * two ways is one name), then 1–20 characters with at least one letter or digit. Uniqueness is per
 * room and is decided by the server when someone joins.
 */
export const nicknameInput = z
  .string()
  .transform((s) => s.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Type a name.")
      .max(LIMITS.NICKNAME_CHARS, `Keep it to ${String(LIMITS.NICKNAME_CHARS)} characters.`)
      .regex(/[\p{L}\p{N}]/u, "Use at least one letter or number."),
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

export const resumeMessage = z.strictObject({
  type: z.literal("resume"),
  checkpoint: z.string().min(1).max(LIMITS.CHECKPOINT_CHARS),
});

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

export const voiceTokenRequest = z.strictObject({ type: z.literal("voice_token") });
export const rematchReadyMessage = z.strictObject({ type: z.literal("rematch_ready") });

export const clientMessage = z.union([
  intentMessage,
  resyncMessage,
  resumeMessage,
  hostMessage,
  voiceTokenRequest,
  rematchReadyMessage,
]);

export type ClientMessage = z.infer<typeof clientMessage>;
export type HostMessage = z.infer<typeof hostMessage>;
export type HostCommandKind = HostMessage["kind"];

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
});

/** One viewer's `view()` after action `seq`. A gap in `seq` means the client sends `resync`. */
export const gameMessage = z.strictObject({
  type: z.literal("game"),
  seq,
  view: z.unknown(),
  checkpoint: z.string().max(LIMITS.CHECKPOINT_CHARS).optional(),
});

export const ackMessage = z.strictObject({ type: z.literal("ack"), clientActionId: id });

export const errorMessage = z.strictObject({
  type: z.literal("error"),
  code: z.enum(ERROR_CODES),
  message: z.string().max(200),
});

export const voiceTokenMessage = z.strictObject({
  type: z.literal("voice_token"),
  token: z.string().min(1).max(4096),
  url: z.url({ protocol: /^wss?$/ }),
});

export const knockMessage = z.strictObject({ type: z.literal("knock"), knockId: id, nickname });

export const serverMessage = z.discriminatedUnion("type", [
  roomMessage,
  gameMessage,
  ackMessage,
  errorMessage,
  voiceTokenMessage,
  knockMessage,
]);

export type ServerMessage = z.infer<typeof serverMessage>;
export type RoomMessage = z.infer<typeof roomMessage>;
