"use client";

import { ErrorState } from "@/components/ErrorState";

/** The game's own boundary: a crash in Bingo never takes the rest of the app down with it. */
export default function BingoError({ reset }: { readonly reset: () => void }) {
  return <ErrorState title="The game hit a snag" action="Reload game" onAction={reset} />;
}
