"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({ reset }: { readonly reset: () => void }) {
  return <ErrorState title="Something went wrong" action="Try again" onAction={reset} />;
}
