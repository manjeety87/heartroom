/**
 * Every game the site offers, as players see it: the one place a game's name, pitch, player count,
 * how-to-play and "vs Computer" link live. Plain data (no client code), so server pages can use it.
 *
 * Adding a game: its id here (it must match the game module's id, which the test checks), then the
 * TypeScript compiler lists everything else that needs it (settings, defaults, preview), because
 * those are `Record<GameId, …>`. Nothing about an existing game changes.
 */
export const GAME_IDS = ["bingo", "word-guess"] as const;

export type GameId = (typeof GAME_IDS)[number];

export type GameEntry = {
  readonly id: GameId;
  readonly name: string;
  /** One sentence: what you do in this game. */
  readonly pitch: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /** The game's turn of play, in order, one short sentence each. */
  readonly howToPlay: readonly string[];
  /** Where to play it alone against the computer; null when it has no computer player. */
  readonly vsComputerHref: string | null;
  /** The game's accent (design-direction › per-game accents), as a CSS colour. */
  readonly accent: string;
  /** Text colour that reads on the accent. */
  readonly onAccent: string;
};

export const GAMES: Readonly<Record<GameId, GameEntry>> = {
  bingo: {
    id: "bingo",
    name: "Bingo",
    pitch: "Fill a grid with 1 to 25, take turns calling numbers, and finish five lines first.",
    minPlayers: 2,
    maxPlayers: 6,
    howToPlay: [
      "Everyone fills their own grid in secret.",
      "Take turns calling a number. Everyone crosses it off.",
      "A full row, column or diagonal is one line.",
      "First to five lines shouts Bingo and wins.",
    ],
    vsComputerHref: "/play/bingo",
    accent: "var(--color-game-bingo)",
    onAccent: "var(--color-on-margin)",
  },
  "word-guess": {
    id: "word-guess",
    name: "Word Guess",
    pitch: "Each of you picks a secret word. Guess the other one’s in fewer tries.",
    minPlayers: 2,
    maxPlayers: 2,
    howToPlay: [
      "Both of you choose a secret everyday word.",
      "Guess your friend’s word. Each guess shows which letters are right.",
      "Solve it in fewer guesses than they do to win.",
    ],
    vsComputerHref: null,
    accent: "var(--color-game-word-guess)",
    onAccent: "var(--color-on-highlighter)",
  },
};

export const GAME_LIST: readonly GameEntry[] = GAME_IDS.map((id) => GAMES[id]);

export const isGameId = (id: string | null | undefined): id is GameId =>
  id !== null && id !== undefined && (GAME_IDS as readonly string[]).includes(id);

export const gameInfo = (id: string | null | undefined): GameEntry | null =>
  isGameId(id) ? GAMES[id] : null;

/** "2–6 players", "2 players". */
export const playersLabel = (game: GameEntry): string =>
  game.minPlayers === game.maxPlayers
    ? `${String(game.minPlayers)} players`
    : `${String(game.minPlayers)}–${String(game.maxPlayers)} players`;
