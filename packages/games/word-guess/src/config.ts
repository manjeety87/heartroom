import { z } from "zod";

/** Word Guess is for exactly two players: each sets a word for the other (DECISIONS 2026-11-10). */
export const SEATS = 2;
export const MIN_LENGTH = 4;
export const MAX_LENGTH = 7;
export const MAX_GUESSES = 10;

/** Time to pick a secret word before the server picks one. */
export const SETUP_MS = 60_000;
/** A guesser who is away this long gets a guess played for them, so a game can't hang forever. */
export const AWAY_GUESS_MS = 60_000;

/**
 * Word length 4–7; guesses from the word length up to 10 (DECISIONS 2026-11-10). The default is as
 * many guesses as letters (CUJ 8: 5 letters, 5 guesses).
 */
export const wordGuessConfigSchema = z
  .strictObject({
    length: z.number().int().min(MIN_LENGTH).max(MAX_LENGTH),
    maxGuesses: z.number().int().min(MIN_LENGTH).max(MAX_GUESSES),
  })
  .refine((c) => c.maxGuesses >= c.length, {
    message: "At least as many guesses as letters.",
    path: ["maxGuesses"],
  });

export type WordGuessConfig = z.infer<typeof wordGuessConfigSchema>;

export const CLASSIC_WORD_GUESS: WordGuessConfig = { length: 5, maxGuesses: 5 };

/** Only the classic setting can count towards rankings. */
export const isClassicWordGuess = (config: WordGuessConfig): boolean =>
  config.length === CLASSIC_WORD_GUESS.length &&
  config.maxGuesses === CLASSIC_WORD_GUESS.maxGuesses;
