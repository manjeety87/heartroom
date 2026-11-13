export { createWordGuess, type WordGuessModule } from "./module.ts";
export {
  CLASSIC_WORD_GUESS,
  isClassicWordGuess,
  MAX_GUESSES,
  MAX_LENGTH,
  MIN_LENGTH,
  SETUP_MS,
  wordGuessConfigSchema,
  type WordGuessConfig,
} from "./config.ts";
export { feedback, isSolved, type Mark } from "./feedback.ts";
export {
  wordGuessActionSchema,
  type WordGuessAction,
  type WordGuessPhase,
  type WordLists,
} from "./rules.ts";
export type { WordGuessSeatView, WordGuessSpectatorView, WordGuessView } from "./view.ts";
