// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createRng, SEED_BYTES } from "@heartroom/engine";
import {
  humanView,
  isBotTurn,
  playBot,
  playHuman,
  startLocalMatch,
  type LocalMatch,
} from "../vs-computer/local-match.ts";
import { feedbackFor } from "../../lib/use-bingo-feedback.ts";
import {
  callCount,
  deleteGame,
  movesThroughCall,
  readHistory,
  saveFinishedGame,
  stateAt,
  type SavedGame,
} from "./history.ts";

const rng = () => createRng(new Uint8Array(SEED_BYTES).fill(6));
const config = { size: 4, linesToWin: 3, timer: "chill" } as const;
const players = [
  { name: "Riya", color: "var(--color-seat-indigo)" },
  { name: "Computer", color: "var(--color-seat-coral)" },
];

function finished(): LocalMatch {
  const botRng = rng();
  let m = startLocalMatch(config, "hard", 1, rng());
  m = playHuman(m, { type: "fill", grid: Array.from({ length: 16 }, (_, i) => i + 1) });
  m = playHuman(m, { type: "ready" });
  while (m.state.phase === "playing") {
    m = isBotTurn(m)
      ? playBot(m, botRng)
      : playHuman(m, {
          type: "call",
          n: humanView(m).grid.find((n) => n !== null && !m.state.called.includes(n)) as number,
        });
  }
  return m;
}

const saved = () => [...readHistory()];

afterEach(() => {
  localStorage.clear();
});

describe("history", () => {
  it("when a finished game is saved, then replaying its record rebuilds the exact final state", () => {
    const match = finished();
    saveFinishedGame(match, players, "g1", new Date("2026-11-11T10:00:00Z"));
    const [game] = saved();
    expect(game).toBeDefined();
    expect(stateAt(game as SavedGame)).toEqual(match.state);
  });

  it("saves a game once even if asked twice, and keeps the newest first", () => {
    saveFinishedGame(finished(), players, "a", new Date());
    saveFinishedGame(finished(), players, "a", new Date());
    saveFinishedGame(finished(), players, "b", new Date());
    expect(saved().map((g) => g.id)).toEqual(["b", "a"]);
    deleteGame("b");
    expect(saved().map((g) => g.id)).toEqual(["a"]);
  });

  it("steps through calls: 0 is the start of play, the last is the end", () => {
    const match = finished();
    saveFinishedGame(match, players, "g", new Date());
    const game = saved()[0] as SavedGame;
    const total = callCount(game);
    expect(stateAt(game, movesThroughCall(game, 0)).called).toEqual([]);
    expect(stateAt(game, movesThroughCall(game, 2)).called).toEqual(match.state.called.slice(0, 2));
    expect(stateAt(game, movesThroughCall(game, total)).phase).toBe("done");
  });

  it("drops a damaged record without losing the others", () => {
    saveFinishedGame(finished(), players, "ok", new Date());
    localStorage.setItem("heartroom.history.v1", JSON.stringify([{ id: "broken" }, ...saved()]));
    expect(readHistory().map((g) => g.id)).toEqual(["ok"]);
  });
});

describe("feedbackFor", () => {
  it("names the biggest change for the viewer: their turn, a line, or a win", () => {
    let m = startLocalMatch(config, "easy", 2, rng());
    m = playHuman(m, { type: "fill", grid: Array.from({ length: 16 }, (_, i) => i + 1) });
    const setup = humanView(m);
    m = playHuman(m, { type: "ready" });
    expect(feedbackFor(null, setup)).toBeNull();
    // Game 2: the computer calls first, so readying is not yet "your turn".
    expect(feedbackFor(setup, humanView(m))).toBeNull();
    const before = humanView(m);
    m = playBot(m, rng());
    expect(feedbackFor(before, humanView(m))).toBe("turn");
  });
});
