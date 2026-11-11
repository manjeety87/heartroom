import type { GameModule, Json, Viewer } from "../module.ts";
import { createRng, SEED_BYTES, type Rng } from "../rng.ts";
import { step } from "../step.ts";
import { startMatch } from "../replay.ts";

export type LeakScenario<Config, State, Action> = {
  readonly name: string;
  readonly config: Config;
  readonly seats: number;
  /** Chooses the next move. Defaults to the deadline seat playing its `autoAction`. */
  readonly nextMove?: (state: State, rng: Rng) => { seat: number; action: Action } | null;
};

export type NoLeakOptions<Config, State, Action> = {
  readonly scenarios: readonly LeakScenario<Config, State, Action>[];
  /** Seeded games played per scenario. */
  readonly games?: number;
  /** Safety cap on moves per game, so a module that never ends fails instead of hanging. */
  readonly maxSteps?: number;
  /** Perturbed states compared per viewer after every step. */
  readonly perturbations?: number;
};

/** Thrown by `assertNoLeak`. The message names where, never what (it may be a secret). */
export class LeakError extends Error {
  override readonly name = "LeakError";
}

/**
 * Indistinguishability test for hidden information. Plays seeded games and, after every step and
 * for every viewer, changes everything that viewer must not know (`perturbHidden`). If the view
 * changes, the view depends on hidden data — a leak. Substring searches cannot do this for games
 * like Bingo, where 1–25 appear on every grid.
 */
export function assertNoLeak<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
  options: NoLeakOptions<Config, State, Action>,
): void {
  const { games = 20, maxSteps = 500, perturbations = 3 } = options;
  let perturbedAnything = false;

  for (const scenario of options.scenarios) {
    for (let game = 0; game < games; game++) {
      const rng = createRng(seedFor(game));
      let state = startMatch(module, {
        config: scenario.config,
        seats: scenario.seats,
        seed: seedFor(game + 1),
      });
      for (let move = 0; ; move++) {
        const where = `scenario "${scenario.name}", game ${String(game)}, after move ${String(move)}`;
        for (const viewer of viewersOf(scenario.seats)) {
          const changed = checkViewer(module, state, viewer, rng, perturbations, where);
          perturbedAnything ||= changed;
        }
        if (module.result(state) !== null) break;
        if (move >= maxSteps)
          throw new LeakError(`${where}: no result after ${String(maxSteps)} moves`);
        const next = (scenario.nextMove ?? defaultMove(module))(state, rng);
        if (next === null) break;
        const result = step(module, state, { ...next, by: "server" });
        if (!result.ok) throw new LeakError(`${where}: scenario move rejected (${result.reason})`);
        state = result.state;
      }
    }
  }

  if (!perturbedAnything) {
    throw new LeakError("perturbHidden never changed a state, so this test proves nothing");
  }
}

/** Returns whether any perturbation actually changed the state. Throws on a leak. */
function checkViewer<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
  state: State,
  viewer: Viewer,
  rng: Rng,
  perturbations: number,
  where: string,
): boolean {
  const label = viewer.kind === "seat" ? `seat ${String(viewer.seat)}` : "spectator";
  const stateJson = canonicalJson(state, `${where}: state`);
  const expected = canonicalJson(module.view(state, viewer), `${where}: view for ${label}`);
  let changed = false;
  for (let i = 0; i < perturbations; i++) {
    const perturbed = module.perturbHidden(state, viewer, rng);
    if (canonicalJson(state, `${where}: state`) !== stateJson) {
      throw new LeakError(`${where}: perturbHidden changed the original state instead of a copy`);
    }
    // Nothing hidden from this viewer (e.g. after the end-of-game reveal): same state, same view.
    if (canonicalJson(perturbed, `${where}: perturbed state`) === stateJson) continue;
    changed = true;
    const actual = canonicalJson(module.view(perturbed, viewer), `${where}: view for ${label}`);
    if (actual !== expected) {
      throw new LeakError(`${where}: the view for ${label} changes with data it must not see`);
    }
  }
  return changed;
}

function defaultMove<Config, State, Action, View extends Json>(
  module: GameModule<Config, State, Action, View>,
) {
  return (state: State, rng: Rng): { seat: number; action: Action } | null => {
    const deadline = module.nextDeadline(state);
    if (deadline === null) return null;
    return { seat: deadline.seat, action: module.autoAction(state, deadline.seat, rng) };
  };
}

function viewersOf(seats: number): Viewer[] {
  const viewers: Viewer[] = Array.from({ length: seats }, (_, seat) => ({ kind: "seat", seat }));
  viewers.push({ kind: "spectator" });
  return viewers;
}

/** Fixed, distinct seeds per game, so a failure reproduces exactly. */
function seedFor(n: number): Uint8Array {
  const seed = new Uint8Array(SEED_BYTES);
  new DataView(seed.buffer).setUint32(0, n + 1, true);
  return seed;
}

/**
 * JSON with sorted keys, so two views compare byte for byte regardless of key order. Anything that
 * is not plain JSON (undefined, NaN, Map, class instances…) is refused: it would not survive the wire.
 */
export function canonicalJson(value: unknown, where: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new LeakError(`${where}: contains a non-finite number`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item: unknown) => canonicalJson(item, where)).join(",")}]`;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, where)}`);
    return `{${entries.join(",")}}`;
  }
  throw new LeakError(`${where}: contains a value that is not plain JSON (${typeof value})`);
}
