"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { isClassic } from "@heartroom/bingo";
import { BingoBoard, CallLog, LineProgress, marksFor, PlayerDot } from "@heartroom/bingo/ui";
import { Button } from "@heartroom/ui";
import {
  callCount,
  deleteGame,
  movesThroughCall,
  stateAt,
  useHistory,
  type SavedGame,
} from "./history.ts";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const LEVEL_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export function HistoryScreen() {
  const games = useHistory();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = games.find((g) => g.id === openId) ?? null;

  if (open) {
    return (
      <GameDetail
        game={open}
        onBack={() => {
          setOpenId(null);
        }}
      />
    );
  }
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-card bg-sheet p-6 shadow-float">
        <p className="text-body text-ink">No games yet.</p>
        <p className="text-small text-pencil">
          Every game you finish is kept here on this device, with every call, so you can step
          through who called what.
        </p>
        <Link
          href="/play/bingo"
          className="inline-flex min-h-11 items-center rounded-pill bg-pen px-5 font-semibold text-on-pen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
        >
          Play vs Computer
        </Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {games.map((game) => (
        <li key={game.id}>
          <button
            type="button"
            onClick={() => {
              setOpenId(game.id);
            }}
            className="flex w-full items-center gap-3 rounded-card bg-sheet p-4 text-left transition-transform duration-(--duration-press) ease-out active:scale-99 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen motion-reduce:transition-none"
          >
            <Outcome game={game} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-ink">{headline(game)}</span>
              <span className="text-small text-pencil">
                {summary(game)} · {dateFormat.format(new Date(game.playedAt))}
              </span>
            </span>
            <span aria-hidden className="text-pencil">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const isWin = (game: SavedGame) => game.winners.includes(0);

function headline(game: SavedGame): string {
  if (game.winners.length > 1) return `Shared win vs Computer (${LEVEL_LABEL[game.level]})`;
  return `${isWin(game) ? "Won" : "Lost"} vs Computer (${LEVEL_LABEL[game.level]})`;
}

function summary(game: SavedGame): string {
  const { size, linesToWin } = game.config;
  const grid = isClassic(game.config)
    ? "Classic 5×5"
    : `${String(size)}×${String(size)}, ${String(linesToWin)} lines`;
  return `${grid} · ${String(callCount(game))} calls`;
}

function Outcome({ game }: { readonly game: SavedGame }) {
  const shared = game.winners.length > 1;
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-pill font-display text-small font-extrabold ${
        isWin(game) || shared ? "bg-pen text-on-pen" : "bg-well text-pencil"
      }`}
    >
      {shared ? "=" : isWin(game) ? "W" : "L"}
    </span>
  );
}

/**
 * One game, rebuilt from its seed and moves. The slider steps through the calls: both grids,
 * who called each number and the lines as they were at that moment.
 */
function GameDetail({ game, onBack }: { readonly game: SavedGame; readonly onBack: () => void }) {
  const total = callCount(game);
  const [calls, setCalls] = useState(total);
  // Deleting can't be undone, so it takes a second, clearly worded tap.
  const [isConfirming, setIsConfirming] = useState(false);
  const sliderId = useId();
  const state = useMemo(() => stateAt(game, movesThroughCall(game, calls)), [game, calls]);
  const lastIndex = state.called.length - 1;
  const lastBy = state.callers[lastIndex];
  const caption =
    calls === 0 || lastBy === undefined
      ? "Grids as the game started"
      : `Call ${String(calls)}: ${game.players[lastBy]?.name ?? "?"} called ${String(state.called[lastIndex])}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="quiet" onClick={onBack} className="-ml-3">
          ‹ All games
        </Button>
        {isConfirming ? (
          <span className="flex items-center gap-1">
            <Button
              variant="quiet"
              onClick={() => {
                setIsConfirming(false);
              }}
            >
              Keep
            </Button>
            <Button
              variant="secondary"
              className="text-margin"
              onClick={() => {
                deleteGame(game.id);
                onBack();
              }}
            >
              Delete game
            </Button>
          </span>
        ) : (
          <Button
            variant="quiet"
            onClick={() => {
              setIsConfirming(true);
            }}
          >
            Delete
          </Button>
        )}
      </div>
      <div>
        <h2 className="font-display text-h2 font-extrabold tracking-tight text-ink">
          {headline(game)}
        </h2>
        <p className="text-small text-pencil">
          {summary(game)} · {dateFormat.format(new Date(game.playedAt))}
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-card bg-sheet p-4">
        <label
          htmlFor={sliderId}
          className="flex items-center justify-between text-small font-semibold text-ink"
        >
          Step through the game
          <span className="tabular-nums text-pencil">
            {calls} / {total}
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={total}
          value={calls}
          onChange={(event) => {
            setCalls(Number(event.target.value));
          }}
          className="h-11 w-full accent-pen"
        />
        <p aria-live="polite" className="text-body text-ink">
          {caption}
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {game.players.map((player, seat) => (
          <li key={seat} className="flex flex-col gap-2 rounded-card bg-sheet p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <PlayerDot color={player.color} isLarge />
                {player.name}
                {state.winners.includes(seat) && (
                  <span className="text-small text-pen">· Winner</span>
                )}
              </span>
              <LineProgress
                count={state.lines[seat]?.length ?? 0}
                linesToWin={game.config.linesToWin}
                isCompact
              />
            </div>
            <BingoBoard
              size={game.config.size}
              grid={state.grids[seat] ?? []}
              marks={marksFor(state, game.players, 0)}
              lines={state.lines[seat] ?? []}
              label={`${player.name}’s grid`}
              isCompact
            />
          </li>
        ))}
      </ul>
      <CallLog view={state} players={game.players} you={0} />
    </div>
  );
}
