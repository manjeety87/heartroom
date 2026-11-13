import { DEV_DATABASE_URL } from "@heartroom/db";
import { z } from "zod";

/**
 * The site's only reader of auth/database env. Parsed on the first auth request, not at import, so
 * `next build` runs without secrets. On Vercel (`VERCEL=1`) every value is required; anywhere else
 * (a laptop, a phone test with `next start`) an unset value falls back to a local one, so a fresh
 * clone works with no account anywhere.
 */

/** `KEY=` in a .env file means "unset". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z
  .object({
    VERCEL: optional(z.string()),
    /** Neon pooled URL. Unset locally → the database `pnpm dev` starts (`DEV_DATABASE_URL`). */
    DATABASE_URL: optional(z.url()),
    /** Signs sessions and encrypts the JWT private key. At least 32 characters. */
    AUTH_SECRET: optional(z.string().min(32)),
    /** The site's public origin. Unset locally → taken from each request (localhost or the LAN IP). */
    AUTH_URL: optional(z.url()),
    /** Google OAuth client (console.cloud.google.com). Sign-in with Google is hidden until both are set. */
    GOOGLE_CLIENT_ID: optional(z.string().min(1)),
    GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  })
  .superRefine((env, ctx) => {
    if ((env.GOOGLE_CLIENT_ID === undefined) !== (env.GOOGLE_CLIENT_SECRET === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "set both GOOGLE_ values",
      });
    }
    if (env.VERCEL === undefined) return;
    for (const key of ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL"] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({ code: "custom", path: [key], message: "required when deployed" });
      }
    }
  });

/**
 * Only ever used where `AUTH_SECRET` is unset and the site isn't deployed. It protects nothing but
 * local test data, so it may live in this public repo.
 */
const LOCAL_SECRET = "heartroom-local-development-secret-not-for-deploys";

export type AuthEnv = {
  readonly databaseUrl: string;
  readonly secret: string;
  readonly baseUrl: string | undefined;
  readonly google: { readonly clientId: string; readonly clientSecret: string } | null;
};

export function parseAuthEnv(env: NodeJS.ProcessEnv): AuthEnv {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const reasons = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    // Names and reasons only, never a value.
    throw new Error(`Invalid auth environment: ${reasons.join("; ")}`);
  }
  return {
    databaseUrl: parsed.data.DATABASE_URL ?? DEV_DATABASE_URL,
    secret: parsed.data.AUTH_SECRET ?? LOCAL_SECRET,
    baseUrl: parsed.data.AUTH_URL,
    google:
      parsed.data.GOOGLE_CLIENT_ID !== undefined && parsed.data.GOOGLE_CLIENT_SECRET !== undefined
        ? { clientId: parsed.data.GOOGLE_CLIENT_ID, clientSecret: parsed.data.GOOGLE_CLIENT_SECRET }
        : null,
  };
}
