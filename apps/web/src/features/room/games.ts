/**
 * The games a room can play, as the site names them. Plain data (no client code), so server pages
 * such as /admin can use it too.
 */
export const ROOM_GAMES = [
  { id: "bingo", label: "Bingo", hint: "2–6 players", min: 2, max: 6 },
  { id: "word-guess", label: "Word Guess", hint: "2 players", min: 2, max: 2 },
] as const;

export type RoomGameId = (typeof ROOM_GAMES)[number]["id"];

export const gameInfo = (id: string | null) => ROOM_GAMES.find((g) => g.id === id) ?? null;
