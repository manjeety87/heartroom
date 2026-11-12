import { newSeed, startMatch, step, type Rng } from "@heartroom/engine";
import {
  bingo,
  chooseCall,
  fillGrid,
  type BingoAction,
  type BingoConfig,
  type BingoSeatView,
  type BingoState,
  type BotLevel,
} from "@heartroom/bingo";

/**
 * vs Computer runs entirely in the browser. It uses the same rules and the same `step()` as the
 * room, so offline play cannot drift from online play. Nothing here is sent anywhere, so it never
 * touches stats.
 */

export const HUMAN = 0;
export const BOT = 1;

export type LocalMatch = {
  readonly state: BingoState;
  readonly level: BotLevel;
  /** Why the last move was refused (a stable reason key), if it was. */
  readonly rejected: string | null;
};

/** A new game. The human calls first in odd games and the computer in even ones. */
export function startLocalMatch(
  config: Omit<BingoConfig, "firstSeat">,
  level: BotLevel,
  gameNumber: number,
  rng: Rng,
): LocalMatch {
  const firstSeat = gameNumber % 2 === 1 ? HUMAN : BOT;
  let state = startMatch(bingo, { config: { ...config, firstSeat }, seats: 2, seed: newSeed() });
  // The computer fills its grid at once; it only ever sees its own seat.
  for (const action of [
    { type: "fill", grid: fillGrid(config.size, rng) },
    { type: "ready" },
  ] as const) {
    const result = step(bingo, state, { seat: BOT, action, by: "server" });
    if (result.ok) state = result.state;
  }
  return { state, level, rejected: null };
}

export function playHuman(match: LocalMatch, action: BingoAction): LocalMatch {
  const result = step(bingo, match.state, { seat: HUMAN, action, by: "player" });
  return result.ok
    ? { ...match, state: result.state, rejected: null }
    : { ...match, rejected: result.reason };
}

export const isBotTurn = (match: LocalMatch): boolean =>
  match.state.phase === "playing" && match.state.turn === BOT;

/** The computer's call, chosen from its own seat view only. */
export function playBot(match: LocalMatch, rng: Rng): LocalMatch {
  if (!isBotTurn(match)) return match;
  const view = bingo.view(match.state, { kind: "seat", seat: BOT }) as BingoSeatView;
  const action: BingoAction = { type: "call", n: chooseCall(view, match.level, rng) };
  const result = step(bingo, match.state, { seat: BOT, action, by: "server" });
  return result.ok ? { ...match, state: result.state } : match;
}

export const humanView = (match: LocalMatch): BingoSeatView =>
  bingo.view(match.state, { kind: "seat", seat: HUMAN }) as BingoSeatView;
