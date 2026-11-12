// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRng, SEED_BYTES } from "@heartroom/engine";
import { CLASSIC } from "../config.ts";
import { bingo } from "../module.ts";
import type { BingoState } from "../rules.ts";
import type { BingoSeatView } from "../view.ts";
import { BingoBoard, type Mark } from "./BingoBoard.tsx";
import { BingoGame } from "./BingoGame.tsx";
import { marksFor } from "./players.tsx";

const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const noMarks = new Map<number, Mark>();
const players = [
  { name: "Riya", color: "red" },
  { name: "Computer", color: "blue" },
];

afterEach(cleanup);

describe("BingoBoard", () => {
  it("labels every cell with its number, who called it and its position", () => {
    const marks = new Map<number, Mark>([[3, { color: "red", isHeavy: false, by: "Computer" }]]);
    render(
      <BingoBoard
        size={3}
        grid={[1, null, 3, 4, 5, 6, 7, 8, 9]}
        marks={marks}
        lines={[]}
        label="Your grid"
      />,
    );
    expect(screen.getByRole("grid", { name: "Your grid" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "3, called by Computer, row 1, column 3" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Empty, row 1, column 2" })).toBeTruthy();
  });

  it("when arrow keys are pressed, then focus moves across the grid, and Enter presses the cell", async () => {
    const onCellPress = vi.fn();
    const user = userEvent.setup();
    render(
      <BingoBoard
        size={3}
        grid={grid}
        marks={noMarks}
        lines={[]}
        label="Your grid"
        onCellPress={onCellPress}
      />,
    );
    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("1, row 1, column 1");
    await user.keyboard("{ArrowRight}{ArrowDown}{End}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("6, row 2, column 3");
    await user.keyboard("{Enter}");
    expect(onCellPress).toHaveBeenCalledWith(5);
  });

  it("when a cell cannot be pressed, then tapping it does nothing", async () => {
    const onCellPress = vi.fn();
    render(
      <BingoBoard
        size={3}
        grid={grid}
        marks={noMarks}
        lines={[]}
        label="Your grid"
        onCellPress={onCellPress}
        canPress={(cell) => cell !== 0}
      />,
    );
    const first = screen.getByRole("button", { name: "1, row 1, column 1" });
    expect(first.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(first);
    expect(onCellPress).not.toHaveBeenCalled();
  });

  it("when the board is read-only, then no cell is in the tab order", () => {
    render(<BingoBoard size={3} grid={grid} marks={noMarks} lines={[0]} label="Riya’s grid" />);
    for (const cell of screen.getAllByRole("button")) expect(cell.tabIndex).toBe(-1);
  });
});

describe("marksFor", () => {
  it("inks each number in its caller's colour, heavier for the viewer's own calls", () => {
    const marks = marksFor({ called: [4, 9], callers: [0, 1] }, players, 0);
    expect(marks.get(4)).toEqual({ color: "red", isHeavy: true, by: "you" });
    expect(marks.get(9)).toEqual({ color: "blue", isHeavy: false, by: "Computer" });
  });
});

describe("BingoGame on a big grid", () => {
  /** An 8×8 game where it is seat 0's turn. */
  function bigView(): BingoSeatView {
    const rng = createRng(new Uint8Array(SEED_BYTES).fill(1));
    const base = bingo.setup({ ...CLASSIC, size: 8, linesToWin: 8 }, 2, rng);
    const identity = Array.from({ length: 64 }, (_, i) => i + 1);
    const state: BingoState = {
      ...base,
      phase: "playing",
      ready: [true, true],
      grids: [identity, identity],
    };
    return bingo.view(state, { kind: "seat", seat: 0 }) as BingoSeatView;
  }

  it("when a number is tapped, then it is only picked; Call confirms it", async () => {
    const onIntent = vi.fn();
    render(<BingoGame view={bigView()} players={players} onIntent={onIntent} />);
    await userEvent.click(screen.getByRole("button", { name: "10, row 2, column 2" }));
    expect(onIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Call 10" }));
    expect(onIntent).toHaveBeenCalledWith({ type: "call", n: 10 });
  });

  it("when the picked number is tapped again, then it is called", async () => {
    const onIntent = vi.fn();
    render(<BingoGame view={bigView()} players={players} onIntent={onIntent} />);
    const cell = screen.getByRole("button", { name: "12, row 2, column 4" });
    await userEvent.click(cell);
    await userEvent.click(cell);
    expect(onIntent).toHaveBeenCalledWith({ type: "call", n: 12 });
  });
});
