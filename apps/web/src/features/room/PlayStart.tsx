"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { roomCodeInput } from "@heartroom/protocol";
import { Button } from "@heartroom/ui";
import { useProfile } from "@/lib/profile";
import { enterRoom } from "@/lib/room-client/client";
import { joinFailureCopy } from "./copy.ts";
import { NameStep } from "./NameStep.tsx";

/** `/play`: start a room for friends, go to one by its code, or play the computer. */
export function PlayStart() {
  const router = useRouter();
  const profile = useProfile();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="start-room" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="start-room" className="font-display text-title font-bold tracking-tight text-ink">
            Start a room
          </h2>
          <p className="text-small text-pencil">You’ll get a code and a link to send to friends.</p>
        </div>
        <NameStep
          submitLabel="Create room"
          onSubmit={async (nickname) => {
            const result = await enterRoom(null, { nickname, color: profile.color });
            if (!result.ok) return joinFailureCopy(result.failure);
            router.push(`/r/${result.code}`);
            return null;
          }}
        />
      </section>

      <section aria-labelledby="join-room" className="flex flex-col gap-3">
        <h2 id="join-room" className="font-display text-title font-bold tracking-tight text-ink">
          Have a code?
        </h2>
        <form
          action={() => {
            const parsed = roomCodeInput.safeParse(code);
            if (!parsed.success) {
              setCodeError(parsed.error.issues[0]?.message ?? "Check the code.");
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
              setCodeError(null);
            }}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={32}
            aria-invalid={codeError !== null}
            aria-describedby="room-code-error"
            className="min-h-11 w-40 rounded-tile bg-well px-3 font-mono text-body tracking-widest text-ink uppercase focus-visible:outline-2 focus-visible:outline-pen"
          />
          <Button type="submit" variant="secondary">
            Join
          </Button>
          <p id="room-code-error" aria-live="polite" className="w-full text-small text-margin">
            {codeError}
          </p>
        </form>
      </section>

      <p className="text-small text-pencil">
        Or{" "}
        <Link
          href="/play/bingo"
          className="font-semibold text-pen underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pen"
        >
          play Bingo against the computer
        </Link>{" "}
        on your own.
      </p>
    </div>
  );
}
