import { describe, expect, it } from "vitest";
import { createRng, SEED_BYTES } from "@heartroom/engine";
import { BOT_LEVELS } from "@heartroom/bingo";
import {
  BOT,
  HUMAN,
  humanView,
  isBotTurn,
  playBot,
  playHuman,
  startLocalMatch,
  type LocalMatch,
} from "./local-match.ts";

const rng = () => createRng(new Uint8Array(SEED_BYTES).fill(4));
const config = { size: 4, linesToWin: 4, timer: "chill" } as const;

/** The human shuffles, readies, then calls their first uncalled number whenever it is their turn. */
function playToEnd(match: LocalMatch, botRng = rng()): LocalMatch {
  let m = playHuman(match, { type: "fill", grid: Array.from({ length: 16 }, (_, i) => i + 1) });
  m = playHuman(m, { type: "ready" });
  for (let guard = 0; m.state.phase === "playing" && guard < 100; guard++) {
    if (isBotTurn(m)) m = playBot(m, botRng);
    else
      m = playHuman(m, {
        type: "call",
        n: humanView(m).grid.find((n) => n !== null && !m.state.called.includes(n)) as number,
      });
  }
  return m;
}

describe("local match", () => {
  it("when a game starts, then the computer is already ready and the human is setting up", () => {
    const match = startLocalMatch(config, "easy", 1, rng());
    expect(match.state.ready).toEqual([false, true]);
    expect(match.state.phase).toBe("setup");
  });

  it("alternates who calls first between games", () => {
    expect(startLocalMatch(config, "easy", 1, rng()).state.turn).toBe(HUMAN);
    expect(startLocalMatch(config, "easy", 2, rng()).state.turn).toBe(BOT);
  });

  it("when the human breaks a rule, then the move is refused with its reason and nothing changes", () => {
    const match = startLocalMatch(config, "easy", 1, rng());
    const refused = playHuman(match, { type: "ready" });
    expect(refused.rejected).toBe("grid_incomplete");
    expect(refused.state).toBe(match.state);
  });

  it("when it is not the computer's turn, then playBot does nothing", () => {
    const match = startLocalMatch(config, "easy", 1, rng());
    expect(playBot(match, rng())).toBe(match);
  });

  it.each(BOT_LEVELS)("plays a whole game to a result against %s", (level) => {
    const end = playToEnd(startLocalMatch(config, level, 2, rng()));
    expect(end.state.phase).toBe("done");
    expect(end.state.winners.length).toBeGreaterThan(0);
  });

  it("never shows the human the computer's grid before the end", () => {
    const view = humanView(startLocalMatch(config, "hard", 1, rng()));
    expect(JSON.stringify(view)).not.toContain('"grids"');
    expect(view.reveal).toBeNull();
  });
});
