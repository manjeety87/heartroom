import type { ZodType } from "zod";
import type { Rng } from "./rng.ts";

/** Who is looking at the game. Every outgoing view is computed for exactly one viewer. */
export type Viewer =
  { readonly kind: "seat"; readonly seat: number } | { readonly kind: "spectator" };

/** Plain JSON data: what views and results must be, because they go on the wire and into Postgres. */
export type Json =
  null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

export type Ok = { readonly ok: true };

/**
 * A rejected action. `reason` is a stable snake_case key the UI maps to copy. It must never describe
 * hidden information ("not your turn" is fine, "that number is on seat 2's grid" is not).
 */
export type RuleError = {
  readonly ok: false;
  readonly code: "NOT_YOUR_TURN" | "RULE_VIOLATION";
  readonly reason: string;
};

export type MatchResult = {
  /** Seats that won; more than one for a shared win. */
  readonly winners: readonly number[];
  /** `placements[seat]` = 1 for first place; ties share a place. */
  readonly placements: readonly number[];
  readonly details: Json;
};

export type Deadline = {
  readonly seat: number;
  /**
   * Milliseconds after the current turn began. Rules have no clock, so the room adds its own
   * turn-start time and plays `autoAction` for `seat` when it passes.
   */
  readonly at: number;
};

/**
 * The contract every game implements. The platform only ever talks to a game through this, so a new
 * game needs no platform change beyond one registry line. All functions are pure and deterministic:
 * no clock, no I/O, no `Math.random` — randomness comes only from the `Rng` passed in. `State` is
 * plain JSON data and is never mutated: `apply` and `perturbHidden` return new objects.
 */
export type GameModule<Config, State, Action, View extends Json> = {
  readonly id: string;
  /** Bumped on any rule change; stored per match so old matches replay with the rules they used. */
  readonly version: number;
  readonly players: { readonly min: number; readonly max: number };
  readonly configSchema: ZodType<Config>;
  /** Every intent from a client is parsed with this before it reaches `validate`. */
  readonly actionSchema: ZodType<Action>;

  setup(config: Config, seats: number, rng: Rng): State;
  validate(state: State, seat: number, action: Action): Ok | RuleError;
  apply(state: State, seat: number, action: Action): State;
  nextDeadline(state: State): Deadline | null;
  /** What the server plays for `seat` when its deadline passes. Must be valid for that state. */
  autoAction(state: State, seat: number, rng: Rng): Action;
  /** The ONLY way game state leaves the room — sockets, logs and errors included. */
  view(state: State, viewer: Viewer): View;
  result(state: State): MatchResult | null;
  /**
   * Test-only: returns a state where everything `viewer` must not know is changed (other seats'
   * grids shuffled, other players' secrets replaced). `assertNoLeak` checks the view stays identical.
   */
  perturbHidden(state: State, viewer: Viewer, rng: Rng): State;
};

/** Identity helper: lets TypeScript infer a module's type parameters from its definition. */
export function defineGame<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
): GameModule<Config, State, Action, View> {
  return module;
}
