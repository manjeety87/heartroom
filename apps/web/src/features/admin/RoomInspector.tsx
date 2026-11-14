"use client";

import type { BingoView } from "@heartroom/bingo";
import { BingoGame } from "@heartroom/bingo/ui";
import type { LiveRoom } from "@heartroom/protocol";
import { seatColorVar } from "@heartroom/ui";
import type { WordGuessView } from "@heartroom/word-guess";
import { WordGuessGame } from "@heartroom/word-guess/ui";

const ignore = () => undefined;

/**
 * A room's game as a spectator sees it: the same game components as the room, fed the public view the
 * game server sent (it never sends a seat's view to the admin page). Moves go nowhere.
 */
export function RoomInspector({ room }: { readonly room: LiveRoom }) {
  const { view } = room;
  if (view === null) {
    return <p className="text-small text-pencil">No game has started in this room yet.</p>;
  }
  const players = room.gamePlayers.map((p) => ({
    name: p.nickname,
    color: seatColorVar(p.color),
  }));
  const status = "Watching as admin. Spectators see exactly this.";
  return (
    <div className="mx-auto w-full max-w-md">
      {view.gameId === "bingo" ? (
        <BingoGame
          view={view.state as BingoView}
          players={players}
          onIntent={ignore}
          status={status}
        />
      ) : view.gameId === "word-guess" ? (
        <WordGuessGame
          view={view.state as WordGuessView}
          players={players}
          onIntent={ignore}
          status={status}
        />
      ) : (
        <p className="text-small text-pencil">This game can’t be shown here yet.</p>
      )}
    </div>
  );
}
