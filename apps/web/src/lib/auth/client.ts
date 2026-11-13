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
