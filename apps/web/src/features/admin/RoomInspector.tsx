"use client";

import { BingoGame } from "@heartroom/bingo/ui";
import type { LiveRoom } from "@heartroom/protocol";
import { seatColorVar } from "@heartroom/ui";
import { WordGuessGame } from "@heartroom/word-guess/ui";
import { parseView } from "@/features/games/views";

const ignore = () => undefined;

/**
 * A room's game as a spectator sees it: the same game components as the room, fed the public view the
 * game server sent (it never sends a seat's view to the admin page), checked against the game's
 * schema like every view. Moves go nowhere.
 */
export function RoomInspector({ room }: { readonly room: LiveRoom }) {
  if (room.view === null) {
    return <p className="text-small text-pencil">No game has started in this room yet.</p>;
  }
  const game = parseView(room.view.gameId, room.view.state);
  if (game === null) {
    return <p className="text-small text-pencil">This game can’t be shown here.</p>;
  }
  const players = room.gamePlayers.map((p) => ({
    name: p.nickname,
    color: seatColorVar(p.color),
  }));
  const status = "Watching as admin. Spectators see exactly this.";
  return (
    <div className="mx-auto w-full max-w-md">
      {game.gameId === "bingo" ? (
        <BingoGame view={game.view} players={players} onIntent={ignore} status={status} />
      ) : (
        <WordGuessGame view={game.view} players={players} onIntent={ignore} status={status} />
      )}
    </div>
  );
}
