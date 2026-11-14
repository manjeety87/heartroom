import type { LiveRoom } from "@heartroom/protocol";

/**
 * What the admin routes can see and do in this process's rooms. Rooms register themselves (the same
 * way they register a voice guard), so the admin code never reaches into a room's private state.
 */
export type LiveRoomHandle = {
  code(): string;
  /** Everything but `inVoice`, which the admin route reads from the database. */
  summary(now: number): Omit<LiveRoom, "inVoice">;
  /** Ends the room for everyone; a game in progress is recorded as abandoned. */
  close(): void;
};

const rooms = new Map<string, LiveRoomHandle>();

export const liveRooms = {
  register(roomUid: string, handle: LiveRoomHandle) {
    rooms.set(roomUid, handle);
  },
  unregister(roomUid: string) {
    rooms.delete(roomUid);
  },
  entries(): [roomUid: string, handle: LiveRoomHandle][] {
    return [...rooms.entries()];
  },
};

/** Without a turn clock a game can sit still for a while; this long is "stuck". */
export const STUCK_WITHOUT_CLOCK_MS = 10 * 60_000;

/** A game is stuck when nothing has moved for twice its turn clock (design doc › Admin › Health). */
export function isStuck(
  phase: LiveRoom["phase"],
  lastActionAt: number,
  turnMs: number | null,
  now: number,
): boolean {
  if (phase !== "playing") return false;
  const limit = turnMs === null ? STUCK_WITHOUT_CLOCK_MS : 2 * turnMs;
  return now - lastActionAt > limit;
}

const startedAt = Date.now();
let reconnects = 0;
let errors = 0;

/** Counters since this process started, for the admin health panel. */
export const health = {
  reconnected() {
    reconnects++;
  },
  failed() {
    errors++;
  },
  read() {
    return { startedAt, reconnects, errors };
  },
};
