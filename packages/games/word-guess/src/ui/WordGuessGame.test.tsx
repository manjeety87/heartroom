// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { WordGuessSeatView } from "../view.ts";
import { WordTile } from "./tiles.tsx";
import { WordGuessGame } from "./WordGuessGame.tsx";

afterEach(cleanup);

const players = [
  { name: "You", color: "blue" },
  { name: "Kabir", color: "red" },
];

const base: WordGuessSeatView = {
  kind: "seat",
  phase: "setup",
  length: 5,
  maxGuesses: 5,
  you: 0,
  yourSecret: null,
  theyHaveSet: false,
  yourGuesses: [],
  theirGuesses: [],
  youFinished: false,
  theyFinished: false,
  theirSecret: null,
};

describe("WordGuessGame", () => {
  it("types a secret on the on-screen keyboard and locks it in with Enter", async () => {
    const onIntent = vi.fn();
    render(<WordGuessGame view={base} players={players} onIntent={onIntent} />);
    expect(screen.getByText("Choose a 5-letter word for Kabir to guess.")).toBeTruthy();
    for (const letter of "apple")
      await userEvent.click(screen.getByRole("button", { name: letter.toUpperCase() }));
    await userEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(onIntent).toHaveBeenCalledWith({ type: "set", word: "apple" });
  });

  it("takes guesses from a physical keyboard and shows the other player's guesses at your word", async () => {
    const onIntent = vi.fn();
    const view: WordGuessSeatView = {
      ...base,
      phase: "guessing",
      yourSecret: "apple",
      theyHaveSet: true,
      theirGuesses: [
        { word: "papal", marks: ["present", "present", "correct", "absent", "present"] },
      ],
    };
    render(<WordGuessGame view={view} players={players} onIntent={onIntent} />);
    await userEvent.keyboard("crane{Enter}");
    expect(onIntent).toHaveBeenCalledWith({ type: "guess", word: "crane" });
    expect(screen.getByText("Kabir’s guesses at your word")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "P, in word, wrong place" }).length).toBeGreaterThan(
      0,
    );
  });

  it("never says a mark by colour alone", () => {
    render(<WordTile letter="a" mark="absent" />);
    expect(screen.getByRole("img", { name: "A, not in word" }).className).toContain("line-through");
  });
});
