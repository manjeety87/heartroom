import type { Metadata } from "next";
import { VsComputer } from "@/features/vs-computer/VsComputer";

export const metadata: Metadata = { title: "Bingo vs Computer" };

export default function BingoVsComputerPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-gutter py-6">
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">
        Bingo vs Computer
      </h1>
      <VsComputer />
    </main>
  );
}
