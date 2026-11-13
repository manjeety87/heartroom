"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bingoConfigSchema, isClassic } from "@heartroom/bingo";
import { Button } from "@heartroom/ui";
import { onlineHistorySchema, type OnlineGame, type OnlineHistory } from "@/lib/history/online";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const GAME_NAMES: Readonly<Record<string, string>> = { bingo: "Bingo" };

type Load =
  | { readonly state: "loading" | "error" }
  | { readonly state: "ready"; readonly data: OnlineHistory };

async function fetchHistory(): Promise<OnlineHistory> {
  const response = await fetch("/api/history", { cache: "no-store" });
  if (!response.ok) throw new Error(`history ${String(response.status)}`);
  return onlineHistorySchema.parse(await response.json());
}

/** Online games from the server: totals per game, then the newest games with who was in them. */
export function OnlineGames() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const run = () =>
    fetchHistory().then(
      (data) => {
        setLoad({ state: "ready", data });
      },
      () => {
        setLoad({ state: "error" });
      },
    );
  const refresh = () => {
    setLoad({ state: "loading" });
    void run();
  };
  // Load once on mount.
  useEffect(() => void run(), []);

  return (
    <section aria-labelledby="online-games" className="flex flex-col gap-3">
      <h2 id="online-games" className="font-display text-title font-bold tracking-tight text-ink">
        Online
      </h2>
      {load.state === "loading" && (
        <div
          aria-busy
          className="h-24 animate-pulse rounded-card bg-well motion-reduce:animate-none"
        />
      )}
      {load.state === "error" && (
        <div className="flex flex-col items-start gap-2 rounded-card bg-sheet p-4">
          <p className="text-body text-ink">Couldn’t load your online games.</p>
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </div>
      )}
      {load.state === "ready" && load.data.games.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-card bg-sheet p-4">
          <p className="text-small text-pencil">
            Games you play in a room with friends show up here, with who won.
          </p>
          <Link
            href="/play"
            className="inline-flex min-h-11 items-center rounded-pill bg-well px-5 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
          >
            Play with friends
          </Link>
        </div>
      )}
      {load.state === "ready" && load.data.games.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-2">
            {load.data.stats.map((stat) => (
              <li
                key={stat.gameId}
                className="rounded-pill bg-well px-3 py-1.5 text-small text-ink"
              >
                <span className="font-semibold">{GAME_NAMES[stat.gameId] ?? stat.gameId}</span> ·{" "}
                {stat.played} played · {formatWins(stat.wins)} {stat.wins === 1 ? "win" : "wins"}
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-2">
            {load.data.games.map((game) => (
              <li key={game.id} className="flex items-center gap-3 rounded-card bg-sheet p-4">
                <Outcome game={game} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{headline(game)}</span>
                  <span className="text-small text-pencil">
                    {grid(game)} · {dateFormat.format(new Date(game.endedAt))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** 1.5 wins reads as "1.5", 2 as "2". */
const formatWins = (wins: number) => String(Math.round(wins * 100) / 100);

type Verdict = "won" | "shared" | "lost" | "abandoned";

function verdictOf(game: OnlineGame): Verdict {
  if (game.status === "abandoned") return "abandoned";
  const share = game.players.find((p) => p.seat === game.you)?.winShare ?? 0;
  if (share >= 1) return "won";
  return share > 0 ? "shared" : "lost";
}

function headline(game: OnlineGame): string {
  const others = game.players
    .filter((p) => p.seat !== game.you)
    .map((p) => p.nickname ?? "someone")
    .join(", ");
  const verb = { won: "Won", shared: "Shared win", lost: "Lost", abandoned: "Unfinished" }[
    verdictOf(game)
  ];
  return others === "" ? verb : `${verb} with ${others}`;
}

function grid(game: OnlineGame): string {
  const config = bingoConfigSchema.safeParse(game.config);
  if (game.gameId !== "bingo" || !config.success) return GAME_NAMES[game.gameId] ?? game.gameId;
  const { size, linesToWin } = config.data;
  return isClassic(config.data)
    ? "Classic 5×5"
    : `${String(size)}×${String(size)}, ${String(linesToWin)} lines`;
}

function Outcome({ game }: { readonly game: OnlineGame }) {
  const verdict = verdictOf(game);
  const mark = { won: "W", shared: "=", lost: "L", abandoned: "–" }[verdict];
  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-pill font-display text-small font-extrabold ${
        verdict === "won" || verdict === "shared" ? "bg-pen text-on-pen" : "bg-well text-pencil"
      }`}
    >
      {mark}
    </span>
  );
}
