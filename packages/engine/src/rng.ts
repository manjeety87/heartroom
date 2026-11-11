/**
 * Seeded randomness for game rules. Rules never call `Math.random`: every random choice comes from
 * an `Rng` built from the match seed, so a match replays exactly from `(config, seed, actions)`.
 */

// Web Crypto is a global in browsers and Node ≥19. The engine runs in both, so it is typed here
// instead of pulling in DOM or Node type definitions (which would let other globals slip in).
declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T };

export const SEED_BYTES = 32;

const UINT32_RANGE = 2 ** 32;

export type Rng = {
  /** Next raw 32-bit unsigned integer. */
  next(): number;
  /** Uniform integer in `[min, max]`, both inclusive, without modulo bias. */
  int(min: number, max: number): number;
  /** A shuffled copy (Fisher–Yates). The input is not changed. */
  shuffle<T>(items: readonly T[]): T[];
  /** One uniformly chosen item. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
};

/** A fresh match seed from the platform's CSPRNG. Made once per match, never sent before it ends. */
export function newSeed(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SEED_BYTES));
}

/** xoshiro128** (Blackman & Vigna): small, fast and well tested; not for secrets, only for play. */
export function createRng(seed: Uint8Array): Rng {
  if (seed.length !== SEED_BYTES) {
    throw new RangeError(`seed must be ${String(SEED_BYTES)} bytes, got ${String(seed.length)}`);
  }
  const state = seedToState(seed);

  const next = (): number => {
    const s0 = state[0];
    const s1 = state[1];
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    state[2] ^= s0;
    state[3] ^= s1;
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = rotl(state[3], 11);
    return result;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError(`int(${String(min)}, ${String(max)}) needs integers with min ≤ max`);
    }
    const range = max - min + 1;
    if (range > UINT32_RANGE) throw new RangeError("int() range is larger than 2^32");
    // Rejection sampling: drop the top sliver of values that would make `% range` uneven.
    const limit = UINT32_RANGE - (UINT32_RANGE % range);
    let value = next();
    while (value >= limit) value = next();
    return min + (value % range);
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError("pick() from an empty array");
    return items[int(0, items.length - 1)] as T;
  };

  return { next, int, shuffle, pick };
}

type State = [number, number, number, number];

/** Folds the 32-byte seed into xoshiro's 128-bit state, so every seed byte matters. */
function seedToState(seed: Uint8Array): State {
  const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  const word = (i: number): number =>
    (view.getUint32(i * 4, true) ^ view.getUint32(i * 4 + 16, true)) >>> 0;
  const state: State = [word(0), word(1), word(2), word(3)];
  // An all-zero state would output zeros forever; any fixed non-zero word fixes it.
  if (state.every((w) => w === 0)) state[0] = 0x9e3779b9;
  return state;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
