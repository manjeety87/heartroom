import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAME_IDS, gameInfo, playersLabel } from "@/features/games/catalog";
import { GAME_PREVIEWS } from "@/features/games/GamePreview";
import { StartRoom } from "@/features/games/StartRoom";

type Props = { readonly params: Promise<{ readonly id: string }> };

/** One page per game in the catalog, built ahead of time; anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GAME_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = gameInfo((await params).id);
  return game === null ? {} : { title: game.name, description: game.pitch };
}

/**
 * Everything about one game: what it is, how to play, and the ways to play it, in the order most
 * people want them (friends first, then the computer where the game has one).
 */
export default async function GamePage({ params }: Props) {
  const game = gameInfo((await params).id);
  if (game === null) notFound();
  const Preview = GAME_PREVIEWS[game.id];

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-10 px-gutter py-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/"
          className="self-start rounded-pill text-small font-semibold text-pencil hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
        >
          All games
        </Link>
        <div className="relative flex items-end justify-between gap-4 pl-5">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 rounded-pill"
            style={{ backgroundColor: game.accent }}
          />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-h1 leading-none font-extrabold tracking-tight text-ink">
              {game.name}
            </h1>
            <p className="text-body text-ink">{game.pitch}</p>
            <p className="text-small text-pencil">{playersLabel(game)}</p>
          </div>
          <span aria-hidden className="hidden shrink-0 sm:block">
            <Preview />
          </span>
        </div>
      </div>

      <section aria-labelledby="with-friends" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="with-friends"
            className="font-display text-title font-bold tracking-tight text-ink"
          >
            Play with friends
          </h2>
          <p className="text-small text-pencil">
            You’ll get a code and a link to send. Talk by voice while you play.
          </p>
        </div>
        <StartRoom gameId={game.id} />
      </section>

      {game.vsComputerHref !== null && (
        <section aria-labelledby="vs-computer" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2
              id="vs-computer"
              className="font-display text-title font-bold tracking-tight text-ink"
            >
              Play alone
            </h2>
            <p className="text-small text-pencil">Against the computer, right here. No sign-in.</p>
          </div>
          <Link
            href={game.vsComputerHref}
            className="inline-flex min-h-11 items-center justify-center self-start rounded-pill bg-well px-6 text-body font-semibold text-ink transition-[scale] duration-(--duration-press) ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen active:scale-[0.97] motion-reduce:active:scale-100"
          >
            Play vs Computer
          </Link>
        </section>
      )}

      <section aria-labelledby="how-to-play" className="flex flex-col gap-3">
        <h2 id="how-to-play" className="font-display text-title font-bold tracking-tight text-ink">
          How to play
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-ink marker:font-semibold marker:text-pencil">
          {game.howToPlay.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
