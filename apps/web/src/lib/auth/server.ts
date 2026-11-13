import { connectPostgres, schema, type Db } from "@heartroom/db";
import { GAME_JWT } from "@heartroom/protocol";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins/anonymous";
import { jwt } from "better-auth/plugins/jwt";
import { parseAuthEnv, type AuthEnv } from "./env.ts";
import { moveGuestToAccount } from "./link.ts";

/**
 * Better Auth for the site: every visitor is a real (anonymous) user, and the JWT plugin signs the
 * short token the game server checks against `/api/auth/jwks`. Google sign-in (when configured) links
 * the guest to a Google account and moves their games over. Server-only: imported by the auth route handler, never by a client component.
 */
function createAuth(env: AuthEnv, db: Db) {
  return betterAuth({
    appName: "Heartroom",
    secret: env.secret,
    ...(env.baseUrl !== undefined && { baseURL: env.baseUrl }),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: { ipAddress: { disableIpTracking: true } },
    ...(env.google !== null && {
      socialProviders: {
        google: {
          clientId: env.google.clientId,
          clientSecret: env.google.clientSecret,
          // Only who you are and the email Better Auth needs to link accounts: no profile, no photo.
          disableDefaultScope: true,
          scope: ["openid", "email"],
          prompt: "select_account",
          // We use the nickname people pick in each room, never their Google name or picture.
          mapProfileToUser: () => ({ name: "", image: undefined }),
        },
      },
    }),
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
      anonymous({
        emailDomainName: "anonymous.heartroom.invalid",
        // Runs before Better Auth deletes the guest row, so the guest's history is never lost.
        onLinkAccount: ({ anonymousUser, newUser }) =>
          moveGuestToAccount(db, anonymousUser.user.id, newUser.user.id),
      }),
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

/**
 * One instance (and one connection pool) per server process. Kept on `globalThis` because `next dev`
 * re-evaluates modules on every edit, which would otherwise open a new pool each time. Built on the
 * first request, not at import, so `next build` needs no environment.
 */
const cache = globalThis as typeof globalThis & { heartroomAuth?: Auth; heartroomDb?: Db };

/** The site's database (same pool as auth): history and account pages read through it. */
export function getDb(): Db {
  cache.heartroomDb ??= connectPostgres(parseAuthEnv(process.env).databaseUrl);
  return cache.heartroomDb;
}

export function getAuth(): Auth {
  cache.heartroomAuth ??= createAuth(parseAuthEnv(process.env), getDb());
  return cache.heartroomAuth;
}

/** Whether "Sign in with Google" can be offered (both Google values are set). */
export function isGoogleEnabled(): boolean {
  return parseAuthEnv(process.env).google !== null;
}
