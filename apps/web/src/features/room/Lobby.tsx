"use client";

import { useEffect, useState } from "react";
import type { RoomMessage } from "@heartroom/protocol";
import { Button, Switch, seatColorVar } from "@heartroom/ui";
import { sendHost } from "@/lib/room-client/client";
import { GAME_IDS, gameInfo, isGameId } from "@/features/games/catalog";
import { firstGameFor, forgetFirstGame } from "./first-game.ts";
import { chooseGame, describeSettings, GAME_SETTINGS, GamePicker } from "./GameSettings.tsx";

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

  const [isChangingGame, setIsChangingGame] = useState(false);

  // A new room has no game yet: the host's screen sends the one picked on the game's page.
  useEffect(() => {
    if (!isHost) return;
    if (room.gameId === null) chooseGame(firstGameFor(room.code) ?? GAME_IDS[0]);
    else forgetFirstGame();
  }, [isHost, room.gameId, room.code]);

  if (!isHost) {
    return (
      <div className="flex flex-col gap-6">
        <PlayerList room={room} me={me} isHost={false} />
        <div aria-live="polite" className="flex flex-col gap-1">
          {game !== null && (
            <p className="text-body font-semibold text-ink">
              {game.name}
              {settings !== null && <span className="font-normal text-pencil"> · {settings}</span>}
            </p>
          )}
          <p className="text-body text-pencil">
            Waiting for {host?.nickname ?? "the host"} to start the {isBetweenGames ? "next " : ""}
            game…
          </p>
        </div>
      </div>
    );
  }

  const seated = room.seats.length;
  const fits = game !== null && present >= game.minPlayers && seated <= game.maxPlayers;
  const Settings = isGameId(room.gameId) ? GAME_SETTINGS[room.gameId] : null;
  return (
    <div className="flex flex-col gap-6">
      <PlayerList room={room} me={me} isHost />
      <section aria-labelledby="game-settings" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2
            id="game-settings"
            className="font-display text-title font-bold tracking-tight text-ink"
          >
            {isBetweenGames ? "Next game: " : ""}
            {game?.name ?? "Pick a game"}
          </h2>
          <Button
            variant="quiet"
            aria-expanded={isChangingGame}
            onClick={() => {
              setIsChangingGame((open) => !open);
            }}
          >
            {isChangingGame ? "Done" : "Change game"}
          </Button>
        </div>
        {isChangingGame && (
          <GamePicker
            room={room}
            onPicked={() => {
              setIsChangingGame(false);
            }}
          />
        )}
        {Settings !== null && <Settings room={room} />}
        <Switch
          label="Lock the room"
          description="Nobody new can join. People already here can still come back."
          checked={room.isLocked}
          onChange={(isLocked) => {
            sendHost({ type: "host", kind: isLocked ? "lock" : "unlock" });
          }}
        />
        {game !== null && seated > game.maxPlayers && (
          <p className="text-small text-pencil">
            {game.name} is for {game.maxPlayers} players. Remove someone, or pick another game.
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
            {game !== null && present < game.minPlayers && (
              <p className="text-small text-pencil">
                {game.name} needs at least {game.minPlayers} players. Invite someone with the code
                above.
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
          {room.seats.length} / {gameInfo(room.gameId)?.maxPlayers ?? 6}
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
