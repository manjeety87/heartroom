import { ERROR_MESSAGES, type ErrorCode } from "@heartroom/protocol";
import { isGameId, type GameId } from "@/features/games/catalog";

/**
 * What to tell a player whose move the server refused. The game's own `reason` key is the most
 * specific; then the game's wording for the error code; then the protocol's safe text. Reasons
 * a player can't cause from the normal UI (bad seats, wrong phase) fall through to the code's copy.
 */
type RefusalCopy = {
  readonly reasons: Readonly<Record<string, string>>;
  readonly codes: Partial<Record<ErrorCode, string>>;
};

const STALE = "The game moved on. Try again.";

const COPY: Readonly<Record<GameId, RefusalCopy>> = {
  bingo: {
    reasons: {
      already_called: "That number was already called. Pick another.",
      already_nudged: "You already nudged them this turn.",
      own_turn: "It’s your call. Pick a number.",
      no_nudge_in_this_mode: "Nudge works only with the Chill clock.",
      grid_incomplete: "Fill every square first, or tap Shuffle.",
      number_used: "That number is already on your grid.",
      cell_taken: "That square is already filled.",
    },
    codes: {
      NOT_YOUR_TURN: "Wait for your turn.",
      STALE_TURN: STALE,
      RULE_VIOLATION: "That move isn’t allowed.",
    },
  },
  "word-guess": {
    reasons: {
      not_a_common_word: "Pick an everyday word for your secret. That one is too rare.",
      not_a_word: "That isn’t a word we know. Try another.",
      wrong_length: "Use every box: fill in all the letters.",
      already_set: "Your word is already set.",
      finished: "You’re done guessing. Wait for your friend.",
    },
    codes: {
      STALE_TURN: STALE,
      RULE_VIOLATION: "That move isn’t allowed.",
    },
  },
};

export function refusalCopy(
  gameId: string | null,
  notice: { readonly code: ErrorCode; readonly reason?: string },
): string {
  const copy = isGameId(gameId) ? COPY[gameId] : null;
  const byReason =
    notice.reason !== undefined && copy !== null && Object.hasOwn(copy.reasons, notice.reason)
      ? copy.reasons[notice.reason]
      : undefined;
  return byReason ?? copy?.codes[notice.code] ?? ERROR_MESSAGES[notice.code];
}
