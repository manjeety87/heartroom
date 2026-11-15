"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roomCodeInput } from "@heartroom/protocol";
import { Button } from "@heartroom/ui";

/** "Have a code?": a friend's room by its six characters. Any game; the room knows which. */
export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-labelledby="join-room" className="flex flex-col gap-3">
      <h2 id="join-room" className="font-display text-title font-bold tracking-tight text-ink">
        Have a code?
      </h2>
      <form
        action={() => {
          const parsed = roomCodeInput.safeParse(code);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Check the code.");
            return;
          }
          router.push(`/r/${parsed.data}`);
        }}
        className="flex flex-wrap items-start gap-2"
      >
        <label className="sr-only" htmlFor="room-code">
          Room code
        </label>
        <input
          id="room-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          placeholder="ABC234"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={32}
          aria-invalid={error !== null}
          aria-describedby="room-code-error"
          className="min-h-11 w-40 rounded-tile bg-well px-3 font-mono text-body tracking-widest text-ink uppercase focus-visible:outline-2 focus-visible:outline-pen"
        />
        <Button type="submit" variant="secondary">
          Join room
        </Button>
        <p id="room-code-error" aria-live="polite" className="w-full text-small text-margin">
          {error}
        </p>
      </form>
    </section>
  );
}
