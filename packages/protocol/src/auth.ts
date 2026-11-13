/**
 * The game-server JWT's fixed claims. Both apps import these: the web signs with them (Better Auth's
 * JWT plugin) and the server pins them in `jwtVerify`. Fixed names rather than URLs, because the
 * site's own address changes between localhost, a phone on the LAN and a deploy.
 */
export const GAME_JWT = {
  issuer: "heartroom-web",
  audience: "heartroom-game",
  algorithm: "EdDSA",
  /** Short-lived: the browser fetches a fresh one for every join. */
  expiresIn: "15m",
} as const;
