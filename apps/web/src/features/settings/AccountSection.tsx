"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@heartroom/ui";
import { readAccount, signInWithGoogle, signOut, type Account } from "@/lib/auth/client";

type Load = { readonly state: "loading" } | { readonly state: "error" } | Account;

/**
 * Settings › Account. Accounts are optional: a guest plays and keeps history on their guest account;
 * Google keeps it on every device. Signing in moves the guest's games to the account.
 */
export function AccountSection({ isGoogleEnabled }: { readonly isGoogleEnabled: boolean }) {
  const [account, setAccount] = useState<Load>({ state: "loading" });
  const [isAdult, setIsAdult] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameBackFailed = useSearchParams().get("signin") === "failed";

  const load = () => {
    readAccount().then(setAccount, () => {
      setAccount({ state: "error" });
    });
  };
  useEffect(load, []);

  if ("state" in account && account.state === "loading") {
    return (
      <div
        aria-busy
        className="h-24 animate-pulse rounded-tile bg-well motion-reduce:animate-none"
      />
    );
  }
  if ("state" in account) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-body text-ink">Couldn’t check your account.</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (account.kind === "google") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">
          Signed in with Google as <span className="font-semibold break-all">{account.email}</span>.
        </p>
        <p className="text-small text-pencil">
          Your online games are kept in your account. Signing out leaves them there.
        </p>
        <Button
          variant="secondary"
          disabled={isBusy}
          onClick={() => {
            setIsBusy(true);
            signOut().then(
              () => {
                setIsBusy(false);
                load();
              },
              () => {
                setIsBusy(false);
                setError("Couldn’t sign out. Try again.");
              },
            );
          }}
        >
          Sign out
        </Button>
        {error !== null && <p className="text-small text-margin">{error}</p>}
      </div>
    );
  }

  const needsAge = account.kind === "none" || !account.isAgeConfirmed;
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-body text-ink">
        {account.kind === "guest"
          ? "You’re playing as a guest. Your online games are kept on this browser only."
          : "You haven’t played online yet. You don’t need an account to play."}
      </p>
      {isGoogleEnabled ? (
        <>
          <p className="text-small text-pencil">
            Sign in with Google to keep your games on every device. Your games so far come with you.
            We keep only your Google ID and email — no name or photo.
          </p>
          {needsAge && (
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
          <Button
            disabled={isBusy || (needsAge && !isAdult)}
            onClick={() => {
              setIsBusy(true);
              setError(null);
              // Success leaves the page for Google; only a failure comes back here.
              signInWithGoogle().catch(() => {
                setIsBusy(false);
                setError("Couldn’t reach Google. Try again.");
              });
            }}
          >
            {isBusy ? "Opening Google…" : "Sign in with Google"}
          </Button>
          <p aria-live="polite" className="min-h-5 text-small text-margin">
            {error ?? (cameBackFailed ? "Google sign-in didn’t finish. Try again." : "")}
          </p>
        </>
      ) : (
        <p className="text-small text-pencil">Google sign-in isn’t set up on this site yet.</p>
      )}
    </div>
  );
}
