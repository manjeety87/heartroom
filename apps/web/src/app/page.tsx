import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-8 px-gutter py-12">
      <h1 className="font-display text-display font-extrabold text-ink">Heartroom</h1>
      <p className="text-title text-pencil">Your notebook Bingo, now with voice.</p>
      <div className="flex flex-col gap-3">
        <Link
          href="/play/bingo"
          className="inline-flex min-h-11 items-center justify-center self-start rounded-pill bg-pen px-6 text-body font-semibold text-on-pen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
        >
          Play vs Computer
        </Link>
        <p className="text-small text-pencil">Rooms with friends are coming soon.</p>
      </div>
    </main>
  );
}
