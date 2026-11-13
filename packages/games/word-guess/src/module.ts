import { defineGame } from "@heartroom/engine";
import { isClassicWordGuess, SEATS, wordGuessConfigSchema } from "./config.ts";
import { createRules, result, setup, wordGuessActionSchema, type WordLists } from "./rules.ts";
import { perturbHidden, view } from "./view.ts";

/**
 * Word Guess as a game module. Built from word lists (server: `@heartroom/word-guess/words`), so the
 * big lists never reach a browser bundle; the UI only needs the types and views.
 */
export function createWordGuess(words: WordLists) {
  const rules = createRules(words);
  return defineGame({
    id: "word-guess",
    version: 1,
    players: { min: SEATS, max: SEATS },
    configSchema: wordGuessConfigSchema,
    isRanked: (config) => isClassicWordGuess(config),
    actionSchema: wordGuessActionSchema,
    setup: (config, seats) => setup(config, seats),
    validate: rules.validate,
    apply: rules.apply,
    nextDeadline: rules.nextDeadline,
    autoAction: rules.autoAction,
    view,
    result,
    perturbHidden,
  });
}

export type WordGuessModule = ReturnType<typeof createWordGuess>;
