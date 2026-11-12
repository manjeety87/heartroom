import { newSeed, startMatch, step, type LogEntry, type Rng } from "@heartroom/engine";
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
 * touches stats. The match keeps its seed and every accepted move, so History can replay it.
 */

export const HUMAN = 0;
export const BOT = 1;

export type LocalMatch = {
  readonly config: BingoConfig;
  readonly seed: Uint8Array;
  readonly state: BingoState;
  /** Every accepted move in order: with the seed, enough to rebuild any moment of the game. */
  readonly log: readonly LogEntry<BingoAction>[];
  readonly level: BotLevel;
  /** Why the last move was refused (a stable reason key), if it was. */
  readonly rejected: string | null;
};

function apply(match: LocalMatch, entry: LogEntry<BingoAction>): LocalMatch {
  const result = step(bingo, match.state, entry);
  return result.ok
    ? { ...match, state: result.state, log: [...match.log, entry], rejected: null }
    : { ...match, rejected: result.reason };
}

/** A new game. The human calls first in odd games and the computer in even ones. */
export function startLocalMatch(
  settings: Omit<BingoConfig, "firstSeat">,
  level: BotLevel,
  gameNumber: number,
  rng: Rng,
): LocalMatch {
  const config: BingoConfig = { ...settings, firstSeat: gameNumber % 2 === 1 ? HUMAN : BOT };
  const seed = newSeed();
  let match: LocalMatch = {
    config,
    seed,
    state: startMatch(bingo, { config, seats: 2, seed }),
    log: [],
    level,
    rejected: null,
  };
  // The computer fills its grid at once; it only ever sees its own seat.
  match = apply(match, {
    seat: BOT,
    action: { type: "fill", grid: fillGrid(config.size, rng) },
    by: "server",
  });
  return apply(match, { seat: BOT, action: { type: "ready" }, by: "server" });
}

export const playHuman = (match: LocalMatch, action: BingoAction): LocalMatch =>
  apply(match, { seat: HUMAN, action, by: "player" });

export const isBotTurn = (match: LocalMatch): boolean =>
  match.state.phase === "playing" && match.state.turn === BOT;

/** The computer's call, chosen from its own seat view only. */
export function playBot(match: LocalMatch, rng: Rng): LocalMatch {
  if (!isBotTurn(match)) return match;
  const view = bingo.view(match.state, { kind: "seat", seat: BOT }) as BingoSeatView;
  return apply(match, {
    seat: BOT,
    action: { type: "call", n: chooseCall(view, match.level, rng) },
    by: "server",
  });
}

export const humanView = (match: LocalMatch): BingoSeatView =>
  bingo.view(match.state, { kind: "seat", seat: HUMAN }) as BingoSeatView;
