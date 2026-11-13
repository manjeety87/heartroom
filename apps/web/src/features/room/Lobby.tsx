"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@heartroom/bingo";
import type { RoomMessage } from "@heartroom/protocol";
import { Button, Switch, seatColorVar } from "@heartroom/ui";
import { sendHost } from "@/lib/room-client/client";

export type PresetId = keyof typeof PRESETS;
const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
const MIN_PLAYERS = 2;

function configFor(preset: PresetId) {
  const { size, linesToWin } = PRESETS[preset];
  // Chill until the screen can show a countdown; the room rotates who calls first by itself.
  return { size, linesToWin, timer: "chill", firstSeat: 0 } as const;
}

/** Who's here and, for the host, the game, the lock and Start. Also sets up the next game. */
export function Lobby({
  room,
  me,
  isBetweenGames,
  preset,
  onPresetChange,
}: {
  readonly room: RoomMessage;
  readonly me: string;
  /** After a game: the results' Rematch starts it, so this panel only sets up the next one. */
  readonly isBetweenGames: boolean;
  /** Held by the room screen, so it survives the game in between (this panel unmounts). */
  readonly preset: PresetId;
  readonly onPresetChange: (preset: PresetId) => void;
}) {
  const isHost = room.hostId === me;
  const present = room.seats.filter((s) => s.isConnected).length;
  const host = [...room.seats, ...room.spectators].find((p) => p.userId === room.hostId);

  // A new room has no game chosen; the host's screen sends its choice straight away.
  useEffect(() => {
    if (isHost && room.gameId === null) {
      sendHost({ type: "host", kind: "config", gameId: "bingo", config: configFor(preset) });
    }
  }, [isHost, room.gameId, preset]);

  return (
    <div className="flex flex-col gap-6">
      <PlayerList room={room} me={me} isHost={isHost} />

      {isHost ? (
        <section aria-labelledby="game-settings" className="flex flex-col gap-4">
          <h2
            id="game-settings"
            className="font-display text-title font-bold tracking-tight text-ink"
          >
            {isBetweenGames ? "Next game" : "Bingo"}
          </h2>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Grid">
            {PRESET_IDS.map((id) => {
              const isChecked = preset === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={isChecked}
                  onClick={() => {
                    onPresetChange(id);
                    sendHost({
                      type: "host",
                      kind: "config",
                      gameId: "bingo",
                      config: configFor(id),
                    });
                  }}
                  className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-card px-3 py-2 text-left ring-2 transition-[box-shadow,background-color,transform] duration-(--duration-press) ease-out active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen motion-reduce:active:scale-100 ${
                    isChecked ? "bg-sheet shadow-float ring-pen" : "bg-well ring-transparent"
                  }`}
                >
                  <span className="text-body font-semibold text-ink">{PRESETS[id].label}</span>
                  <span className="text-caption text-pencil">
                    {PRESETS[id].linesToWin} lines to win
                  </span>
                </button>
              );
            })}
          </div>
          <Switch
            label="Lock the room"
            description="Nobody new can join. People already here can still come back."
            checked={room.isLocked}
            onChange={(isLocked) => {
              sendHost({ type: "host", kind: isLocked ? "lock" : "unlock" });
            }}
          />
          {!isBetweenGames && (
            <>
              <Button
                disabled={present < MIN_PLAYERS}
                className="self-stretch sm:self-start"
                onClick={() => {
                  sendHost({ type: "host", kind: "start" });
                }}
              >
                Start game
              </Button>
              {present < MIN_PLAYERS && (
                <p className="text-small text-pencil">
                  Bingo needs at least {MIN_PLAYERS} players. Invite someone with the code above.
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <p aria-live="polite" className="text-body text-pencil">
          Waiting for {host?.nickname ?? "the host"} to start the {isBetweenGames ? "next " : ""}
          game…
        </p>
      )}
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
        Players <span className="text-pencil">{room.seats.length} / 6</span>
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
