import type { GameModule, Json } from "./module.ts";
import { createRng } from "./rng.ts";
import { step, type LogEntry } from "./step.ts";

export type MatchStart<Config> = {
  readonly config: Config;
  readonly seed: Uint8Array;
  readonly seats: number;
};

export type MatchRecord<Config, Action> = MatchStart<Config> & {
  readonly actions: readonly LogEntry<Action>[];
};

/** Thrown when a stored log does not replay: the log or the module version is wrong, not a player. */
export class ReplayError extends Error {
  override readonly name = "ReplayError";
  readonly index: number;

  constructor(index: number, reason: string) {
    super(`action ${String(index)} was rejected on replay (${reason})`);
    this.index = index;
  }
}

/** The initial state of a match. Only `setup` sees the seed's randomness. */
export function startMatch<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
  match: MatchStart<Config>,
): State {
  return module.setup(match.config, match.seats, createRng(match.seed));
}

/** Rebuilds a match's state from its record by folding `step` over the log. */
export function replay<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
  match: MatchRecord<Config, Action>,
): State {
  let state = startMatch(module, match);
  match.actions.forEach((entry, index) => {
    const result = step(module, state, entry);
    if (!result.ok) throw new ReplayError(index, result.reason);
    state = result.state;
  });
  return state;
}
