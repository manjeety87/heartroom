import { GameShelf } from "@/features/games/GameShelf";
import { JoinByCode } from "@/features/games/JoinByCode";

/** Home: pick a game, or go straight into a friend's room with its code. */
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-gutter py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-display font-extrabold text-ink">Heartroom</h1>
        <p className="max-w-md text-title text-pencil">
          Short games with your friends, and you can talk while you play.
        </p>
      </div>
      <GameShelf />
      <JoinByCode />
    </main>
  );
}
