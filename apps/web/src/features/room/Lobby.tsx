"use client";

import { useEffect, useState } from "react";
import type { RoomMessage } from "@heartroom/protocol";
import { Button, Switch, seatColorVar } from "@heartroom/ui";
import { sendHost } from "@/lib/room-client/client";
import {
  BingoSettings,
  chooseGame,
  describeSettings,
  gameInfo,
  GamePicker,
  WordGuessSettings,
} from "./GameSettings.tsx";

/** Who's here and, for the host, the game, the lock and Start. Also sets up the next game. */
export function Lobby({
  room,
  me,
  isBetweenGames,
}: {
  readonly room: RoomMessage;
  readonly me: string;
  /** After a game: the results' Rematch starts it, so this panel only sets up the next one. */
  readonly isBetweenGames: boolean;
}) {
  const isHost = room.hostId === me;
  const present = room.seats.filter((s) => s.isConnected).length;
  const host = [...room.seats, ...room.spectators].find((p) => p.userId === room.hostId);
  const game = gameInfo(room.gameId);
  const settings = describeSettings(room);

  // A new room has no game chosen; the host's screen picks Bingo straight away.
  useEffect(() => {
    if (isHost && room.gameId === null) chooseGame("bingo");
  }, [isHost, room.gameId]);

  if (!isHost) {
    return (
      <div className="flex flex-col gap-6">
        <PlayerList room={room} me={me} isHost={false} />
        <div aria-live="polite" className="flex flex-col gap-1">
          {settings !== null && <p className="text-body font-semibold text-ink">{settings}</p>}
          <p className="text-body text-pencil">
            Waiting for {host?.nickname ?? "the host"} to start the {isBetweenGames ? "next " : ""}
            game…
          </p>
        </div>
      </div>
    );
  }

  const seated = room.seats.length;
  const fits = game !== null && present >= game.min && seated <= game.max;
  return (
    <div className="flex flex-col gap-6">
      <PlayerList room={room} me={me} isHost />
      <section aria-labelledby="game-settings" className="flex flex-col gap-4">
        <h2
          id="game-settings"
          className="font-display text-title font-bold tracking-tight text-ink"
        >
          {isBetweenGames ? "Next game" : "Game"}
        </h2>
        <GamePicker room={room} />
        {room.gameId === "bingo" && <BingoSettings room={room} />}
        {room.gameId === "word-guess" && <WordGuessSettings room={room} />}
        <Switch
          label="Lock the room"
          description="Nobody new can join. People already here can still come back."
          checked={room.isLocked}
          onChange={(isLocked) => {
            sendHost({ type: "host", kind: isLocked ? "lock" : "unlock" });
          }}
        />
        {game !== null && seated > game.max && (
          <p className="text-small text-pencil">
            {game.label} is for {game.max} players. Remove someone, or pick another game.
          </p>
        )}
        {!isBetweenGames && (
          <>
            <Button
              disabled={!fits || settings === null}
              className="self-stretch sm:self-start"
              onClick={() => {
                sendHost({ type: "host", kind: "start" });
              }}
            >
              Start game
            </Button>
            {game !== null && present < game.min && (
              <p className="text-small text-pencil">
                {game.label} needs at least {game.min} players. Invite someone with the code above.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function PlayerList({
  room,
  me,
  isHost,
}: {
  readonly room: RoomMessage;
  readonly me: string;
  readonly isHost: boolean;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  // Removing is a ban for this room, so it takes a second, clearly worded tap.
  const removeButton = (userId: string, nickname: string) => {
    if (!isHost || userId === me) return null;
    if (confirming === userId) {
      return (
        <Button
          variant="secondary"
          onClick={() => {
            sendHost({ type: "host", kind: "kick", target: userId });
            setConfirming(null);
          }}
        >
          Remove {nickname}
        </Button>
      );
    }
    return (
      <Button
        variant="quiet"
        aria-label={`Remove ${nickname}`}
        onClick={() => {
          setConfirming(userId);
        }}
      >
        Remove
      </Button>
    );
  };

  return (
    <section aria-labelledby="players" className="flex flex-col gap-2">
      <h2 id="players" className="font-display text-title font-bold tracking-tight text-ink">
        Players{" "}
        <span className="text-pencil">
          {room.seats.length} / {gameInfo(room.gameId)?.max ?? 6}
        </span>
      </h2>
      <ul className="flex flex-col">
        {room.seats.map((seat) =>
          seat.userId === null || seat.nickname === null ? null : (
            <li
              key={seat.userId}
              className="flex min-h-12 items-center gap-3 border-b border-line py-1"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full bg-pencil"
                style={seat.color ? { backgroundColor: seatColorVar(seat.color) } : undefined}
              />
              <span className="min-w-0 flex-1 truncate text-body text-ink">
                {seat.nickname}
                {seat.userId === me && <span className="text-pencil"> (you)</span>}
              </span>
              {seat.userId === room.hostId && (
                <span className="text-caption text-pencil">Host</span>
              )}
              {!seat.isConnected && <span className="text-caption text-pencil">Away</span>}
              {removeButton(seat.userId, seat.nickname)}
            </li>
          ),
        )}
      </ul>
      {room.spectators.length > 0 && (
        <>
          <h3 className="mt-2 text-small font-semibold text-pencil">
            Watching ({room.spectators.length})
          </h3>
          <ul className="flex flex-col">
            {room.spectators.map((s) => (
              <li key={s.userId} className="flex min-h-11 items-center gap-3 text-body text-ink">
                <span className="min-w-0 flex-1 truncate">
                  {s.nickname}
                  {s.userId === me && <span className="text-pencil"> (you)</span>}
                </span>
                {removeButton(s.userId, s.nickname)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
