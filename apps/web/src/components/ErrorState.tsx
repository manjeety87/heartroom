"use client";

import { Button } from "@heartroom/ui";

/** What a crashed screen shows instead: plain words and one way forward, never the raw error. */
export function ErrorState({
  title,
  action,
  onAction,
}: {
  readonly title: string;
  readonly action: string;
  readonly onAction: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-gutter py-12">
      <h1 className="font-display text-h2 font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="text-body text-pencil">Your settings and history are safe on this device.</p>
      <Button onClick={onAction}>{action}</Button>
    </main>
  );
}
