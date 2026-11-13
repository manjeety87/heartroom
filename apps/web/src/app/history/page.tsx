import type { Metadata } from "next";
import { HistoryScreen } from "@/features/history/HistoryScreen";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-6">
      <div>
        <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">History</h1>
        <p className="text-small text-pencil">
          Your online games, and games against the computer on this device.
        </p>
      </div>
      <HistoryScreen />
    </main>
  );
}
