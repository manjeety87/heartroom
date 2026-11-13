import { LIMITS, SEAT_COLOR_IDS, type SeatColorId } from "@heartroom/protocol";

/** Someone in the room: a player (with a seat) or a spectator (`seat: null`). */
export type Member = {
  readonly userId: string;
  readonly nickname: string;
  readonly color: SeatColorId;
  /** Room seat 0–5, or null for a spectator. */
  readonly seat: number | null;
  /** The Colyseus session currently holding this member; replaced on takeover. */
  readonly sessionId: string;
  readonly isConnected: boolean;
};

/** Names compare the way people read them: "Riya" and "riya" are the same name. */
const sameName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

/** Cuts at whole graphemes, so an emoji or a Devanagari syllable is never split in half. */
function truncate(text: string, maxLength: number): string {
  let out = "";
  for (const { segment } of new Intl.Segmenter().segment(text)) {
    if (out.length + segment.length > maxLength) break;
    out += segment;
  }
  return out;
}

/**
 * Null when `nickname` is free in the room for `userId`, else the first free "Name 2", "Name 3"…,
 * shortened so the suffix still fits in the 20-character limit.
 */
export function nameSuggestion(
  nickname: string,
  userId: string,
  members: readonly Member[],
): string | null {
  const taken = members.filter((m) => m.userId !== userId).map((m) => m.nickname);
  const isTaken = (name: string) => taken.some((t) => sameName(t, name));
  if (!isTaken(nickname)) return null;
  for (let n = 2; ; n++) {
    const suffix = ` ${String(n)}`;
    const base = truncate(nickname, LIMITS.NICKNAME_CHARS - suffix.length).trimEnd();
    const candidate = `${base}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
}

/** The wished colour if no one else has it, else the first free one in `SEAT_COLOR_IDS` order. */
export function pickColor(
  wish: SeatColorId | undefined,
  userId: string,
  members: readonly Member[],
): SeatColorId {
  const taken = new Set(members.filter((m) => m.userId !== userId).map((m) => m.color));
  if (wish !== undefined && !taken.has(wish)) return wish;
  // Six colours, at most six players; a spectator past that shares one, which is harmless.
  return SEAT_COLOR_IDS.find((id) => !taken.has(id)) ?? wish ?? SEAT_COLOR_IDS[0];
}

/** The lowest free room seat, or null when every seat is taken. */
export function freeSeat(members: readonly Member[], maxSeats: number): number | null {
  const used = new Set(members.map((m) => m.seat));
  for (let seat = 0; seat < maxSeats; seat++) if (!used.has(seat)) return seat;
  return null;
}

/** Who becomes host when the host leaves: the connected player in the lowest seat, else anyone connected. */
export function nextHost(members: readonly Member[], leavingUserId: string): string | null {
  const candidates = members.filter((m) => m.userId !== leavingUserId && m.isConnected);
  const players = candidates
    .filter((m) => m.seat !== null)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  return (players[0] ?? candidates[0])?.userId ?? null;
}
