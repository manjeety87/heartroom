import { createRng, SEED_BYTES, startMatch, step } from "@heartroom/engine";
import { chooseCall, fillGrid, type BotLevel } from "../bot.ts";
import type { BingoConfig } from "../config.ts";
import { bingo } from "../module.ts";
import type { BingoAction, BingoState } from "../rules.ts";
import type { BingoSeatView } from "../view.ts";

/** Fixed seed number n → a 32-byte seed, so every simulated game reproduces exactly. */
export function seedFor(n: number): Uint8Array {
  const seed = new Uint8Array(SEED_BYTES);
  new DataView(seed.buffer).setUint32(0, n, true);
  seed[31] = 1;
  return seed;
}

/** Plays a whole game between bots (one level per seat) through the engine's `step`. */
export function playBotMatch(
  config: BingoConfig,
  levels: readonly BotLevel[],
  n: number,
): BingoState {
  const rng = createRng(seedFor(n + 1_000_000));
  let state = startMatch(bingo, { config, seats: levels.length, seed: seedFor(n) });
  const play = (seat: number, action: BingoAction) => {
    const result = step(bingo, state, { seat, action, by: "player" });
    if (!result.ok) throw new Error(`seat ${seat} ${action.type} rejected: ${result.reason}`);
    state = result.state;
  };
  levels.forEach((_, seat) => {
    play(seat, { type: "fill", grid: fillGrid(config.size, rng) });
    play(seat, { type: "ready" });
  });
  while (state.phase === "playing") {
    const seat = state.turn;
    const view = bingo.view(state, { kind: "seat", seat }) as BingoSeatView;
    play(seat, { type: "call", n: chooseCall(view, levels[seat] as BotLevel, rng) });
  }
  return state;
}
