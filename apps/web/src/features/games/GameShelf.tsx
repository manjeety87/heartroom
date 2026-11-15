import Link from "next/link";
import { GAME_LIST, playersLabel } from "./catalog.ts";
import { GAME_PREVIEWS } from "./GamePreview.tsx";

/**
 * Every game as a page from the notebook: the margin line in the game's own colour, its name, what
 * you do, how many can play and a small picture of it. The whole page is one link to the game.
 */
export function GameShelf() {
  return (
    <ul className="flex flex-col gap-3" aria-label="Games">
      {GAME_LIST.map((game) => {
        const Preview = GAME_PREVIEWS[game.id];
        return (
          <li key={game.id}>
            <Link
              href={`/games/${game.id}`}
              className="group relative flex min-h-36 items-center gap-4 overflow-hidden rounded-card bg-sheet py-5 pr-4 pl-7 transition-[background-color,scale] duration-(--duration-press) ease-out hover:bg-well/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen active:scale-[0.98] motion-reduce:active:scale-100 sm:pr-6"
            >
              {/* The notebook's margin line, in this game's colour. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-2"
                style={{ backgroundColor: game.accent }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-h2 leading-none font-extrabold tracking-tight text-ink">
                  {game.name}
                </span>
                <span className="text-body text-ink">{game.pitch}</span>
                <span className="text-small text-pencil">
                  {playersLabel(game)}
                  {game.vsComputerHref !== null && ", or alone vs the computer"}
                </span>
              </span>
              <span aria-hidden className="hidden shrink-0 min-[420px]:block">
                <Preview />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
