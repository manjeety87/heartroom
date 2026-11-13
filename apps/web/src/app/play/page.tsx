import type { Metadata } from "next";
import { PlayStart } from "@/features/room/PlayStart";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-gutter py-6">
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">
        Play with friends
      </h1>
      <PlayStart />
    </main>
  );
}
