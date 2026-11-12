import type { Metadata } from "next";
import Link from "next/link";
import { VsComputer } from "@/features/vs-computer/VsComputer";

export const metadata: Metadata = { title: "Bingo vs Computer" };

export default function BingoVsComputerPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-gutter py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-h2 font-extrabold text-ink">Bingo vs Computer</h1>
        <Link href="/" className="text-small text-pen underline-offset-4 hover:underline">
          Home
        </Link>
      </header>
      <VsComputer />
    </main>
  );
}
