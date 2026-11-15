import { isGameId, type GameId } from "@/features/games/catalog";

/**
 * The game a host picked before their room existed (on that game's page). The lobby sends it as the
 * room's first config, once the room exists. Kept in sessionStorage so a refresh before the lobby loads still has it;
 * storage can be blocked, so every access is guarded and the fallback is the first game.
 */
const KEY = "heartroom.first-game.v1";

export function rememberFirstGame(code: string, gameId: GameId): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, gameId }));
  } catch {
    // Without storage the lobby falls back to the first game; the host can change it there.
  }
}

/**
 * The remembered game for this room, if any. Reading doesn't remove it: React may run the lobby's
 * effect twice, and both runs must send the same game. `forgetFirstGame` clears it once the room has one.
 */
export function firstGameFor(code: string): GameId | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return null;
    const { code: savedCode, gameId } = saved as { code?: unknown; gameId?: unknown };
    return savedCode === code && typeof gameId === "string" && isGameId(gameId) ? gameId : null;
  } catch {
    return null;
  }
}

export function forgetFirstGame(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored, or storage blocked: nothing to forget.
  }
}
