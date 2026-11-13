import {
  createRng,
  newSeed,
  startMatch,
  step,
  type Deadline,
  type GameModule,
  type Json,
  type LogEntry,
  type MatchResult,
  type Rng,
  type Viewer,
} from "@heartroom/engine";
import type { ErrorCode } from "@heartroom/protocol";

/**
 * A running match with its game's types erased behind closures, so the room drives any game through
 * one shape and never sees `State`. Hidden state is reachable only through `view` (AGENTS.md).
 */
export type Match = {
  readonly gameId: string;
  readonly seats: number;
  /** Number of accepted actions; the `seq` of every view and the `turnSeq` an intent quotes. */
  turnSeq(): number;
  /**
   * True when an intent made from the view at `turnSeq` is out of date: the game has since moved to
   * another turn (another deadline key). Moves inside the same turn don't make it stale, because
   * players act at once in some phases (every Bingo player fills their grid during "setup").
   */
  isStale(turnSeq: number): boolean;
  /** Parses `raw` with the game's `actionSchema`, then validates and applies it for `seat`. */
  play(
    seat: number,
    raw: unknown,
  ): { readonly ok: true } | { readonly ok: false; readonly code: ErrorCode };
  /** Plays the game's `autoAction` for `seat` (its deadline passed). */
  autoPlay(seat: number): void;
  view(viewer: Viewer): Json;
  deadline(): Deadline | null;
  result(): MatchResult | null;
};

export type MatchSetup = {
  readonly gameId: string;
  readonly players: { readonly min: number; readonly max: number };
  /** Throws a RangeError when the config doesn't fit `seats` (e.g. a first seat that isn't there). */
  start(seats: number, seed: Uint8Array): Match;
};

/** Parses a host's config for `module`; null when it doesn't match the game's `configSchema`. */
export function prepareMatch<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
  rawConfig: unknown,
): MatchSetup | null {
  const parsed = module.configSchema.safeParse(rawConfig);
  if (!parsed.success) return null;
  const config = parsed.data;
  return {
    gameId: module.id,
    players: module.players,
    start(seats, seed) {
      let state = startMatch(module, { config, seats, seed });
      const log: LogEntry<Action>[] = [];
      /** `turnKeys[seq]` = the deadline key after `seq` actions (null when the game sets none). */
      const turnKeys: (string | null)[] = [module.nextDeadline(state)?.key ?? null];
      // Auto-play needs randomness the players can't predict; it never comes from the match seed.
      const serverRng: Rng = createRng(newSeed());

      const apply = (entry: LogEntry<Action>) => {
        const outcome = step(module, state, entry);
        if (!outcome.ok) return { ok: false as const, code: outcome.code };
        state = outcome.state;
        log.push(entry);
        turnKeys.push(module.nextDeadline(state)?.key ?? null);
        return { ok: true as const };
      };

      return {
        gameId: module.id,
        seats,
        turnSeq: () => log.length,
        isStale: (turnSeq) => turnSeq > log.length || turnKeys[turnSeq] !== turnKeys[log.length],
        play(seat, raw) {
          const action = module.actionSchema.safeParse(raw);
          if (!action.success) return { ok: false, code: "INVALID_MESSAGE" };
          return apply({ seat, action: action.data, by: "player" });
        },
        autoPlay(seat) {
          const outcome = apply({
            seat,
            action: module.autoAction(state, seat, serverRng),
            by: "server",
          });
          // autoAction must always be legal; if it isn't, the game module has a bug.
          if (!outcome.ok)
            throw new Error(`${module.id}: autoAction was rejected (${outcome.code})`);
        },
        view: (viewer) => module.view(state, viewer),
        deadline: () => module.nextDeadline(state),
        result: () => module.result(state),
      };
    },
  };
}
