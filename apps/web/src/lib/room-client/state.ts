import {
  CLOSE_CODES,
  type ErrorCode,
  type JoinError,
  type RoomMessage,
  type ServerMessage,
} from "@heartroom/protocol";

/**
 * The live room as this browser knows it, and the pure rules that update it. `client.ts` feeds it
 * server messages; screens read it through selectors. No socket code here, so it is unit-tested.
 */

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  /** The server restarted; coming back with the last checkpoint (design doc › Deploys and crashes). */
  | "resuming"
  | "closed";

export type ClosedReason =
  | "left"
  | "kicked"
  | "banned"
  | "taken_over"
  | "room_closed"
  | "invalid_messages"
  | "restarting"
  /** The socket died and reconnecting gave up. */
  | "lost";

/** An intent waiting for its `ack`; resent after a reconnect (the server re-acks a duplicate). */
export type PendingIntent = {
  readonly clientActionId: string;
  readonly turnSeq: number;
  readonly action: unknown;
};

export type RoomState = {
  readonly status: ConnectionStatus;
  /** The signed-in user's id, to find "me" among seats, players and the host. */
  readonly me: string | null;
  readonly room: RoomMessage | null;
  /** The latest view. Views are full snapshots, so only the newest one matters. */
  readonly game: { readonly seq: number; readonly view: unknown } | null;
  readonly outbox: readonly PendingIntent[];
  /** The last refusal from the server; `id` changes so the same code twice still shows twice. */
  readonly notice: { readonly id: number; readonly code: ErrorCode } | null;
  readonly closed: ClosedReason | null;
  /** The room's newest sealed checkpoint: opaque, only handed back after a restart. */
  readonly checkpoint: string | null;
  /** Back in after a restart, until the rebuilt room speaks (it waits up to 5 s for everyone). */
  readonly isRestoring: boolean;
  /** The current turn's clock in this browser's time; `endsAt` null while it is paused. */
  readonly deadline: TurnClock | null;
};

export type TurnClock = {
  readonly seat: number;
  readonly key: string;
  readonly endsAt: number | null;
  readonly totalMs: number;
};

export const INITIAL_STATE: RoomState = {
  status: "idle",
  me: null,
  room: null,
  game: null,
  outbox: [],
  notice: null,
  closed: null,
  checkpoint: null,
  isRestoring: false,
  deadline: null,
};

/** `now` is this browser's clock when the message arrived (a deadline is sent as time left). */
export function applyServerMessage(
  state: RoomState,
  message: ServerMessage,
  now: number,
): RoomState {
  switch (message.type) {
    case "room": {
      // A new game restarts `seq` at 0, so the last game's view must not outrank it.
      const isNewGame = message.phase === "playing" && state.room?.phase !== "playing";
      return { ...state, room: message, isRestoring: false, ...(isNewGame && { game: null }) };
    }
    case "game":
      // An older view can arrive after a newer one (a resend after a stale move); never go back.
      if (state.game !== null && message.seq < state.game.seq) return state;
      return {
        ...state,
        game: { seq: message.seq, view: message.view },
        // Once the game moves on, an earlier refusal is old news.
        ...(state.game !== null && message.seq > state.game.seq && { notice: null }),
      };
    case "ack":
      return {
        ...state,
        outbox: state.outbox.filter((p) => p.clientActionId !== message.clientActionId),
      };
    case "error":
      // Voice has its own channel back (`requestVoiceToken`); it never touches the game's moves.
      if (message.code === "VOICE_UNAVAILABLE") return state;
      // The server answers in order and names no intent, so a refusal ends everything pending:
      // the refused move must not be resent, and anything after it was made from an outdated view.
      return {
        ...state,
        outbox: [],
        notice: { id: (state.notice?.id ?? 0) + 1, code: message.code },
      };
    case "checkpoint":
      return { ...state, checkpoint: message.checkpoint };
    case "deadline": {
      const clock = message.deadline;
      return {
        ...state,
        deadline:
          clock === null
            ? null
            : {
                seat: clock.seat,
                key: clock.key,
                endsAt: clock.msLeft === null ? null : now + clock.msLeft,
                totalMs: clock.totalMs,
              },
      };
    }
    case "voice_token":
    case "knock":
      return state;
  }
}

const REASON_BY_CODE: ReadonlyMap<number, ClosedReason> = new Map([
  [CLOSE_CODES.RESTARTING, "restarting"],
  [CLOSE_CODES.KICKED, "kicked"],
  [CLOSE_CODES.BANNED, "banned"],
  [CLOSE_CODES.TAKEN_OVER, "taken_over"],
  [CLOSE_CODES.ROOM_CLOSED, "room_closed"],
  [CLOSE_CODES.INVALID_MESSAGES, "invalid_messages"],
]);

/** Why the room ended for this browser, from the close code (or our own consented leave). */
export function closedReasonFor(code: number, didWeLeave: boolean): ClosedReason {
  if (didWeLeave) return "left";
  return REASON_BY_CODE.get(code) ?? "lost";
}

/** A refused create/join, or the game server not answering at all. */
export type JoinFailure =
  | JoinError
  | { readonly code: "UNREACHABLE"; readonly message: string; readonly suggestion?: never };
