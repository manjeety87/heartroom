"use client";

import { ErrorState } from "@/components/ErrorState";

/** The room's own boundary: a crash here leaves the rest of the site working. */
export default function RoomError({ reset }: { readonly reset: () => void }) {
  return <ErrorState title="The room hit a snag" action="Reload room" onAction={reset} />;
}
