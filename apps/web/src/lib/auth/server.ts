import { connectPostgres, openLocal, schema, type Db } from "@heartroom/db";
import { GAME_JWT } from "@heartroom/protocol";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins/anonymous";
import { jwt } from "better-auth/plugins/jwt";
import { parseAuthEnv, type AuthEnv } from "./env.ts";

/**
 * Better Auth for the site: every visitor is a real (anonymous) user, and the JWT plugin signs the
 * short token the game server checks against `/api/auth/jwks`. Google sign-in arrives in Phase 4.
 * Server-only: imported by the auth route handler, never by a client component.
 */
function createAuth(env: AuthEnv, db: Db) {
  return betterAuth({
    appName: "Heartroom",
    secret: env.secret,
    ...(env.baseUrl !== undefined && { baseURL: env.baseUrl }),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: { ipAddress: { disableIpTracking: true } },
    user: {
      additionalFields: {
        // Set by the person through `updateUser` when they tick the 18+ box; never at sign-up.
        ageConfirmedAt: { type: "date", required: false, input: true },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // We keep no user agent or IP (design doc › Accounts and identity).
          before: (session) =>
            Promise.resolve({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
    plugins: [
      anonymous({ emailDomainName: "anonymous.heartroom.invalid" }),
      jwt({
        jwks: { keyPairConfig: { alg: GAME_JWT.algorithm, crv: "Ed25519" } },
        jwt: {
          issuer: GAME_JWT.issuer,
          audience: GAME_JWT.audience,
          expirationTime: GAME_JWT.expiresIn,
          // The game server needs only who you are; the subject is the user id.
          definePayload: () => ({}),
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

async function openDb(env: AuthEnv): Promise<Db> {
  return env.databaseUrl !== undefined ? connectPostgres(env.databaseUrl) : openLocal(env.localDb);
}

/**
 * One instance per server process. Kept on `globalThis` because `next dev` re-evaluates modules on
 * every edit, and PGlite refuses a second open of the same folder.
 */
const cache = globalThis as typeof globalThis & { heartroomAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  cache.heartroomAuth ??= (async () => {
    const env = parseAuthEnv(process.env);
    return createAuth(env, await openDb(env));
  })();
  return cache.heartroomAuth;
}
