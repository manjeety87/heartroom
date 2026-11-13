"use client";

import { useMemo } from "react";
import type { BingoAction, BingoView } from "@heartroom/bingo";
import { BingoGame, type Player } from "@heartroom/bingo/ui";
import { ERROR_MESSAGES, type RoomMessage } from "@heartroom/protocol";
import { seatColorVar } from "@heartroom/ui";
import { useProfile } from "@/lib/profile";
import { sendHost, sendIntent, useRoom } from "@/lib/room-client/client";
import { useBingoFeedback } from "@/lib/use-bingo-feedback";
import { TurnClock } from "./TurnClock.tsx";

/** Copy for refusals of a move; anything else uses the protocol's safe text. */
const MOVE_REFUSALS: Partial<Record<keyof typeof ERROR_MESSAGES, string>> = {
  NOT_YOUR_TURN: "Wait for your turn.",
  STALE_TURN: "The game moved on. Try again.",
  RULE_VIOLATION: "That move isn’t allowed.",
};

/**
 * The game area of the room: the same `BingoGame` as vs Computer, fed by the server's view for this
 * person. Players are named in the game's seat order (`matchPlayers`), which the room rotates.
 */
export function RoomGame({ room, me }: { readonly room: RoomMessage; readonly me: string }) {
  const profile = useProfile();
  // Views come from our own server for the game the room says it is playing.
  const view = useRoom((s) => s.game?.view ?? null) as BingoView | null;
  const notice = useRoom((s) => s.notice);
  const isLive = useRoom((s) => s.status === "live");
  const clock = useRoom((s) => s.deadline);
  const isHost = room.hostId === me;

  const players: readonly Player[] = useMemo(
    () =>
      (room.matchPlayers ?? []).map((p) => ({
        name: p.userId === me ? "You" : p.nickname,
        color: seatColorVar(p.color),
      })),
    [room.matchPlayers, me],
  );
  useBingoFeedback(view?.kind === "seat" ? view : null, profile);

  if (view === null) {
    return (
      <div
        aria-busy
        className="h-80 animate-pulse rounded-card bg-well motion-reduce:animate-none"
      />
    );
  }

  const host = room.matchPlayers?.find((p) => p.userId === room.hostId)?.nickname ?? "the host";
  const status = !isLive
    ? "Reconnecting… your seat is held for a minute."
    : notice !== null
      ? (MOVE_REFUSALS[notice.code] ?? ERROR_MESSAGES[notice.code])
      : view.kind === "spectator" && view.phase !== "done"
        ? "You’re watching this game."
        : view.phase === "done" && !isHost
          ? `Waiting for ${host} to start the next game.`
          : undefined;

  const names = (room.matchPlayers ?? []).map((p) => p.nickname);
  return (
    <div className="flex flex-col gap-4">
      {clock !== null && view.phase !== "done" && (
        <TurnClock clock={clock} names={names} me={view.kind === "seat" ? view.you : null} />
      )}
      <BingoGame
        view={view}
        players={players}
        onIntent={(action: BingoAction) => {
          sendIntent(action);
        }}
        {...(status === undefined ? {} : { status })}
        {...(isHost && {
          onRematch: () => {
            sendHost({ type: "host", kind: "start" });
          },
        })}
      />
    </div>
  );
}
