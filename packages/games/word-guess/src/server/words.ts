import { createRequire } from "node:module";
import { MAX_LENGTH, MIN_LENGTH } from "../config.ts";
import type { WordLists } from "../rules.ts";

/**
 * The English word lists, for the game server only (Node; never imported by a browser bundle).
 * From SCOWL via `wordlist-english` (copyright Kevin Atkinson and others; permissive licence, see
 * that package's `Copyright` file). Secrets come from the everyday sizes (≤ 50), guesses from
 * everything up to size 70. American, British, Canadian and Australian spellings all count, so
 * "colour" and "color" are both fine.
 */

const require = createRequire(import.meta.url);
const DIALECTS = ["english", "american", "british", "canadian", "australian"] as const;
const COMMON_SIZES = [10, 20, 35, 40, 50] as const;
const VALID_SIZES = [...COMMON_SIZES, 55, 60, 70] as const;

/** Lowercase a–z only, 4–7 letters: no proper nouns, apostrophes or accents. */
const PLAYABLE = new RegExp(`^[a-z]{${String(MIN_LENGTH)},${String(MAX_LENGTH)}}$`);

function load(sizes: readonly number[]): Set<string> {
  const words = new Set<string>();
  for (const dialect of DIALECTS) {
    for (const size of sizes) {
      const list = require(`wordlist-english/${dialect}-words-${String(size)}.json`) as string[];
      for (const word of list) if (PLAYABLE.test(word)) words.add(word);
    }
  }
  return words;
}

export function loadEnglishWords(): WordLists {
  const common = load(COMMON_SIZES);
  const valid = load(VALID_SIZES);
  const byLength = new Map<number, string[]>();
  for (const word of [...common].sort()) {
    const list = byLength.get(word.length) ?? [];
    list.push(word);
    byLength.set(word.length, list);
  }
  return {
    isCommon: (word) => common.has(word),
    isValid: (word) => valid.has(word),
    commonOfLength: (length) => byLength.get(length) ?? [],
  };
}
