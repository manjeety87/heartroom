"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@heartroom/ui";
import { confirmAge, ensureGuest, readGuest } from "@/lib/auth/client";
import { checkName, saveProfile, useProfile } from "@/lib/profile";

export type NameStepResult = { readonly message: string; readonly suggestion?: string } | null;

/**
 * The one step before a room: your name and, the first time only, "I'm 18 or older"
 * (design doc › Accounts and identity). `onSubmit` creates or joins and answers with a problem to
 * show, or null when it went through. A refused duplicate name comes back with a free one filled in.
 */
export function NameStep({
  submitLabel,
  onSubmit,
  initialError = null,
}: {
  readonly submitLabel: string;
  readonly onSubmit: (nickname: string) => Promise<NameStepResult>;
  readonly initialError?: string | null;
}) {
  const profile = useProfile();
  const [name, setName] = useState<string | null>(null);
  const [isAdult, setIsAdult] = useState(false);
  const [askAge, setAskAge] = useState(true);
  const [error, setError] = useState<string | null>(initialError);
  const [isBusy, setIsBusy] = useState(false);
  const nameId = useId();
  const errorId = useId();
  const value = name ?? profile.name ?? "";

  useEffect(() => {
    let isCurrent = true;
    readGuest()
      .then((guest) => {
        if (isCurrent && guest?.isAgeConfirmed) setAskAge(false);
      })
      .catch(() => {
        // Unknown: keep asking; confirming twice does no harm.
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const submit = async () => {
    const checked = checkName(value);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    if (askAge && !isAdult) {
      setError("Tick the box to confirm you’re 18 or older.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await ensureGuest();
      if (askAge) await confirmAge();
    } catch {
      setIsBusy(false);
      setError("We couldn’t reach Heartroom. Check your connection and try again.");
      return;
    }
    saveProfile({ ...profile, name: checked.name });
    const problem = await onSubmit(checked.name);
    setIsBusy(false);
    if (problem === null) return;
    setError(problem.message);
    if (problem.suggestion !== undefined) setName(problem.suggestion);
  };

  return (
    <form
      action={() => {
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-small font-semibold text-ink">
          Your name
        </label>
        <input
          id={nameId}
          value={value}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          autoComplete="nickname"
          enterKeyHint="go"
          maxLength={40}
          aria-invalid={error !== null}
          aria-describedby={errorId}
          className="min-h-11 rounded-tile bg-well px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-pen"
        />
      </div>
      {askAge && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={isAdult}
            onChange={(event) => {
              setIsAdult(event.target.checked);
              setError(null);
            }}
            className="size-5 accent-pen"
          />
          I’m 18 or older
        </label>
      )}
      <p id={errorId} aria-live="polite" className="min-h-5 text-small text-margin">
        {error}
      </p>
      <Button type="submit" disabled={isBusy} className="self-stretch sm:self-start">
        {isBusy ? "One moment…" : submitLabel}
      </Button>
    </form>
  );
}
