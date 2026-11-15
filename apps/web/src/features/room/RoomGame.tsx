"use client";

import { useMemo } from "react";
import type { BingoAction } from "@heartroom/bingo";
import { BingoGame } from "@heartroom/bingo/ui";
import type { RoomMessage } from "@heartroom/protocol";
import { seatColorVar } from "@heartroom/ui";
import type { WordGuessAction } from "@heartroom/word-guess";
import { WordGuessGame } from "@heartroom/word-guess/ui";
import { ErrorState } from "@/components/ErrorState";
import { parseView } from "@/features/games/views";
import { useProfile } from "@/lib/profile";
import { sendHost, sendIntent, useRoom } from "@/lib/room-client/client";
import { useBingoFeedback } from "@/lib/use-bingo-feedback";
import { refusalCopy } from "./refusals.ts";
import { TurnClock } from "./TurnClock.tsx";

/**
 * The game area of the room: the same game components as vs Computer, fed by the server's view for
 * this person, checked against that game's schema first. Players are named in the game's seat order
 * (`matchPlayers`), which the room rotates.
 */
export function RoomGame({ room, me }: { readonly room: RoomMessage; readonly me: string }) {
  const profile = useProfile();
  const raw = useRoom((s) => s.game);
  const notice = useRoom((s) => s.notice);
  const isLive = useRoom((s) => s.status === "live");
  const clock = useRoom((s) => s.deadline);
  const isHost = room.hostId === me;
  const game = useMemo(() => (raw === null ? null : parseView(raw.gameId, raw.view)), [raw]);

  const players = useMemo(
    () =>
      (room.matchPlayers ?? []).map((p) => ({
        name: p.userId === me ? "You" : p.nickname,
        color: seatColorVar(p.color),
      })),
    [room.matchPlayers, me],
  );
  useBingoFeedback(
    game?.gameId === "bingo" && game.view.kind === "seat" ? game.view : null,
    profile,
  );

  if (raw === null) {
    return (
      <div
        aria-busy
        className="h-80 animate-pulse rounded-card bg-well motion-reduce:animate-none"
      />
    );
  }
  if (game === null) {
    // A view this site can't read: an older page after a deploy, or a bug. Never draw a guess.
    return (
      <ErrorState
        title="This game didn’t load. Reload the page to get the latest version."
        action="Reload"
        onAction={() => {
          window.location.reload();
        }}
      />
    );
  }

  const { view } = game;
  const host = room.matchPlayers?.find((p) => p.userId === room.hostId)?.nickname ?? "the host";
  const status = !isLive
    ? "Reconnecting… your seat is held for a minute."
    : notice !== null
      ? refusalCopy(game.gameId, notice)
      : game.gameId === "bingo" && view.kind === "spectator" && view.phase !== "done"
        ? "You’re watching this game."
        : view.phase === "done" && !isHost
          ? `Waiting for ${host} to start the next game.`
          : undefined;
  const statusProps = status === undefined ? {} : { status };
  const rematch = isHost
    ? {
        onRematch: () => {
          sendHost({ type: "host", kind: "start" });
        },
      }
    : {};

  const names = (room.matchPlayers ?? []).map((p) => p.nickname);
  return (
    <div className="flex flex-col gap-4">
      {clock !== null && view.phase !== "done" && (
        <TurnClock
          clock={clock}
          names={names}
          me={view.kind === "seat" ? view.you : null}
          gameId={game.gameId}
        />
      )}
      {game.gameId === "bingo" ? (
        <BingoGame
          view={game.view}
          players={players}
          onIntent={(action: BingoAction) => {
            sendIntent(action);
          }}
          {...statusProps}
          {...rematch}
        />
      ) : (
        <WordGuessGame
          view={game.view}
          players={players}
          onIntent={(action: WordGuessAction) => {
            sendIntent(action);
          }}
          {...statusProps}
          {...rematch}
        />
      )}
    </div>
  );
}
