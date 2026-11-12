// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BingoBoard } from "./BingoBoard.tsx";

const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9];

afterEach(cleanup);

describe("BingoBoard", () => {
  it("labels every cell with its number, called state and position", () => {
    render(
      <BingoBoard
        size={3}
        grid={[1, null, 3, 4, 5, 6, 7, 8, 9]}
        called={[3]}
        lines={[]}
        label="Your grid"
      />,
    );
    expect(screen.getByRole("grid", { name: "Your grid" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "3, called, row 1, column 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Empty, row 1, column 2" })).toBeTruthy();
  });

  it("when arrow keys are pressed, then focus moves across the grid, and Enter presses the cell", async () => {
    const onCellPress = vi.fn();
    const user = userEvent.setup();
    render(
      <BingoBoard
        size={3}
        grid={grid}
        called={[]}
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
        called={[1]}
        lines={[]}
        label="Your grid"
        onCellPress={onCellPress}
        canPress={(cell) => cell !== 0}
      />,
    );
    const first = screen.getByRole("button", { name: "1, called, row 1, column 1" });
    expect(first.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(first);
    expect(onCellPress).not.toHaveBeenCalled();
  });

  it("when the board is read-only, then no cell is in the tab order", () => {
    render(<BingoBoard size={3} grid={grid} called={[]} lines={[0]} label="Riya’s grid" />);
    for (const cell of screen.getAllByRole("button")) expect(cell.tabIndex).toBe(-1);
  });
});
