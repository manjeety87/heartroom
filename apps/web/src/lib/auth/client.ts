"use client";

import { createAuthClient } from "better-auth/client";
import { anonymousClient, inferAdditionalFields, jwtClient } from "better-auth/client/plugins";

/** Same-origin: the site's own `/api/auth`, so it works on localhost, a LAN IP and a deploy alike. */
export const authClient = createAuthClient({
  plugins: [
    anonymousClient(),
    jwtClient(),
    inferAdditionalFields({ user: { ageConfirmedAt: { type: "date", required: false } } }),
  ],
});

export type Guest = { readonly id: string; readonly isAgeConfirmed: boolean };

/** The visitor's account if they have one; never creates one (a page view isn't a sign-up). */
export async function readGuest(): Promise<Guest | null> {
  const session = await authClient.getSession();
  if (session.error !== null || session.data === null) return null;
  const { user } = session.data;
  return { id: user.id, isAgeConfirmed: user.ageConfirmedAt != null };
}

/** The visitor's account, signing them in as a guest first if they have none yet. */
export async function ensureGuest(): Promise<Guest> {
  const existing = await readGuest();
  if (existing !== null) return existing;
  const signIn = await authClient.signIn.anonymous();
  if (signIn.error !== null) throw new Error("guest sign-in failed");
  return { id: signIn.data.user.id, isAgeConfirmed: false };
}

/** Remembers on the account that the person said they are 18 or older, so we ask only once. */
export async function confirmAge(): Promise<void> {
  const result = await authClient.updateUser({ ageConfirmedAt: new Date() });
  if (result.error !== null) throw new Error("could not save the age confirmation");
}

/** A fresh game-server token (15 minutes), fetched right before every create/join. */
export async function getGameToken(): Promise<string> {
  const result = await authClient.token();
  if (result.error !== null) throw new Error("token request failed");
  return result.data.token;
}

export type Account =
  | { readonly kind: "none" }
  | { readonly kind: "guest"; readonly isAgeConfirmed: boolean }
  | { readonly kind: "google"; readonly email: string };

/** Who this browser is signed in as, for the Settings › Account section. */
export async function readAccount(): Promise<Account> {
  const session = await authClient.getSession();
  if (session.error !== null) throw new Error("session read failed");
  if (session.data === null) return { kind: "none" };
  const { user } = session.data;
  return user.isAnonymous === true
    ? { kind: "guest", isAgeConfirmed: user.ageConfirmedAt != null }
    : { kind: "google", email: user.email };
}

/**
 * Leaves for Google and comes back to Settings. The visitor becomes a guest first (if they aren't)
 * and their 18+ answer is saved on it, so linking carries both over to the Google account.
 */
export async function signInWithGoogle(): Promise<void> {
  await ensureGuest();
  await confirmAge();
  const result = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/settings",
    errorCallbackURL: "/settings?signin=failed",
  });
  if (result.error !== null) throw new Error("google sign-in failed");
}

/** Signs out of the account on this browser; the games stay in the account. */
export async function signOut(): Promise<void> {
  const result = await authClient.signOut();
  if (result.error !== null) throw new Error("sign-out failed");
}
