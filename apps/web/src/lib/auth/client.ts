"use client";

import { createAuthClient } from "better-auth/client";
import { anonymousClient, jwtClient } from "better-auth/client/plugins";

/** Same-origin: the site's own `/api/auth`, so it works on localhost, a LAN IP and a deploy alike. */
export const authClient = createAuthClient({ plugins: [anonymousClient(), jwtClient()] });

/**
 * A fresh game-server token for the visitor, signing them in as a guest first if they have no
 * session yet. Called right before every create/join, since a token lives only 15 minutes.
 */
export async function getGameToken(): Promise<string> {
  const session = await authClient.getSession();
  if (session.data === null) {
    const signIn = await authClient.signIn.anonymous();
    if (signIn.error !== null) throw new Error(signIn.error.message ?? "guest sign-in failed");
  }
  const result = await authClient.token();
  if (result.error !== null) throw new Error(result.error.message ?? "token request failed");
  return result.data.token;
}
