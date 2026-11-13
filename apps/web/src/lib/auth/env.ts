import path from "node:path";
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
    /** Neon pooled URL. Unset locally → PGlite in `<repo>/.data/pglite`. */
    DATABASE_URL: optional(z.url()),
    /** Signs sessions and encrypts the JWT private key. At least 32 characters. */
    AUTH_SECRET: optional(z.string().min(32)),
    /** The site's public origin. Unset locally → taken from each request (localhost or the LAN IP). */
    AUTH_URL: optional(z.url()),
  })
  .superRefine((env, ctx) => {
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
  readonly databaseUrl: string | undefined;
  readonly localDb: { readonly dataDir: string; readonly migrationsDir: string };
  readonly secret: string;
  readonly baseUrl: string | undefined;
};

export function parseAuthEnv(env: NodeJS.ProcessEnv): AuthEnv {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const reasons = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    // Names and reasons only, never a value.
    throw new Error(`Invalid auth environment: ${reasons.join("; ")}`);
  }
  // `next dev` / `next start` run with apps/web as the working directory.
  const repoRoot = path.resolve(process.cwd(), "../..");
  return {
    databaseUrl: parsed.data.DATABASE_URL,
    localDb: {
      dataDir: path.join(repoRoot, ".data", "pglite"),
      migrationsDir: path.join(repoRoot, "packages", "db", "drizzle"),
    },
    secret: parsed.data.AUTH_SECRET ?? LOCAL_SECRET,
    baseUrl: parsed.data.AUTH_URL,
  };
}
