/** What one tile says about its letter. */
export type Mark = "correct" | "present" | "absent";

/**
 * The two-pass rule for repeated letters. First every letter in the right place is `correct` and
 * uses up that letter of the secret; then, left to right, a letter is `present` only while the secret
 * still has an unused copy of it, else `absent`. So secret APPLE, guess PAPAL gives
 * present, present, correct, absent, present: the second A finds no A left.
 */
export function feedback(secret: string, guess: string): Mark[] {
  if (secret.length !== guess.length) throw new RangeError("secret and guess differ in length");
  const marks: Mark[] = Array.from({ length: guess.length }, () => "absent");
  const unused = new Map<string, number>();
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      marks[i] = "correct";
    } else {
      const letter = secret[i] as string;
      unused.set(letter, (unused.get(letter) ?? 0) + 1);
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue;
    const letter = guess[i] as string;
    const left = unused.get(letter) ?? 0;
    if (left > 0) {
      marks[i] = "present";
      unused.set(letter, left - 1);
    }
  }
  return marks;
}

export const isSolved = (marks: readonly Mark[]): boolean => marks.every((m) => m === "correct");
