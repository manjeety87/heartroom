import { GAME_JWT } from "@heartroom/protocol";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Who is connecting. A real client sends the JWT that Better Auth on the site signed (anonymous
 * guests included); it is checked against the site's JWKS with the algorithm, issuer and audience
 * pinned. Outside production a `dev:<id>` token is also accepted, so tests and scripts can seat
 * several users without a running site. Production never accepts one.
 */
const DEV_TOKEN = /^dev:([A-Za-z0-9_-]{1,64})$/;
const CLOCK_SKEW_SECONDS = 30;

export type Identity = { readonly userId: string };
export type VerifyToken = (token: string | undefined) => Promise<Identity | null>;

export function createTokenVerifier(options: {
  readonly isProduction: boolean;
  /** The site's `/api/auth/jwks`. Keys are fetched once and refetched only for an unknown `kid`. */
  readonly keys: JWTVerifyGetKey | URL;
}): VerifyToken {
  const keys = options.keys instanceof URL ? createRemoteJWKSet(options.keys) : options.keys;
  return async (token) => {
    if (token === undefined || token === "") return null;
    if (!options.isProduction) {
      const dev = DEV_TOKEN.exec(token);
      if (dev?.[1] !== undefined) return { userId: `dev-${dev[1]}` };
    }
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: [GAME_JWT.algorithm],
        issuer: GAME_JWT.issuer,
        audience: GAME_JWT.audience,
        requiredClaims: ["exp", "sub"],
        clockTolerance: CLOCK_SKEW_SECONDS,
      });
      return payload.sub === undefined ? null : { userId: payload.sub };
    } catch {
      // Expired, forged, wrong audience or the site unreachable: all mean "not let in". The room
      // answers UNAUTHORIZED, and the browser fetches a fresh token and tries again.
      return null;
    }
  };
}
