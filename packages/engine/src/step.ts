import type { GameModule, Json, RuleError } from "./module.ts";

/** One entry of a match's action log. `server` = played by the room (timeout or auto-play). */
export type LogEntry<Action> = {
  readonly seat: number;
  readonly action: Action;
  readonly by: "player" | "server";
};

export type StepResult<State> = { readonly ok: true; readonly state: State } | RuleError;

/**
 * Validates then applies one logged action. The room, the offline match and `replay` all go through
 * this one function, so live play and replay cannot drift apart.
 */
export function step<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
  state: State,
  entry: LogEntry<Action>,
): StepResult<State> {
  const verdict = module.validate(state, entry.seat, entry.action);
  if (!verdict.ok) return verdict;
  return { ok: true, state: module.apply(state, entry.seat, entry.action) };
}
