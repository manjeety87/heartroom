import { DEV_DATABASE_URL } from "@heartroom/db";
import { z } from "zod";

/**
 * The only reader of `process.env`. Parsed once at import; a missing or malformed variable stops the
 * boot with its name and the reason, never its value (the repo and the logs are public-ish).
 * Variables are added here when the code that needs them lands, not before.
 */

/** `KEY=` in a .env file means "unset", not "empty string". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const originList = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.union([z.literal("*"), z.url()])).min(1));

const DEV_JWKS_URL = "http://localhost:3000/api/auth/jwks";

/**
 * Only for development, where it protects nothing but local test games; it is fixed (not random per
 * boot) so a restarted dev server can still open the checkpoints the browsers hold. Public on purpose.
 */
const DEV_CHECKPOINT_KEY = Buffer.alloc(32, "heartroom-dev-checkpoint-key");

const checkpointKey = z
  .string()
  .transform((raw) => Buffer.from(raw, "base64"))
  .refine((key) => key.length === 32, "must be base64 of exactly 32 bytes");

const envSchema = z
  .object({
    NODE_ENV: optional(z.enum(["development", "test", "production"])).default("development"),
    PORT: optional(z.coerce.number().int().min(1).max(65_535)).default(2567),
    /**
     * Optional outside production: a phone on the LAN opens the site at http://<laptop-ip>:3000, which
     * no fixed list can name, so development allows every origin. Production must list them.
     */
    ALLOWED_ORIGINS: optional(originList),
    /**
     * The site's Better Auth key set. Development defaults to the site on this laptop (port 3000);
     * a deploy must name it, because a wrong guess would lock every player out.
     */
    AUTH_JWKS_URL: optional(z.url()),
    /** Neon pooled URL. Development defaults to the local database `pnpm dev` starts. */
    DATABASE_URL: optional(z.url()),
    /** AES-256-GCM key for crash-recovery checkpoints. Rotation: move the old one to _PREVIOUS. */
    CHECKPOINT_KEY: optional(checkpointKey),
    CHECKPOINT_KEY_PREVIOUS: optional(checkpointKey),
    /** LiveKit Cloud project (wss://…). Voice is off until all three are set. */
    LIVEKIT_URL: optional(z.url({ protocol: /^wss?$/ })),
    LIVEKIT_API_KEY: optional(z.string().min(1)),
    LIVEKIT_API_SECRET: optional(z.string().min(1)),
    /** Kill switch: "false" turns voice off without removing the keys. */
    VOICE_ENABLED: optional(z.enum(["true", "false"])).default("true"),
    LOG_LEVEL: optional(z.enum(["fatal", "error", "warn", "info", "debug", "trace"])).default(
      "info",
    ),
  })
  .superRefine((env, ctx) => {
    const livekit = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
    const setCount = livekit.filter((key) => env[key] !== undefined).length;
    if (setCount > 0 && setCount < livekit.length) {
      for (const key of livekit.filter((k) => env[k] === undefined)) {
        ctx.addIssue({ code: "custom", path: [key], message: "set all three LIVEKIT_ values" });
      }
    }
    if (env.NODE_ENV !== "production") return;
    for (const key of ["AUTH_JWKS_URL", "CHECKPOINT_KEY", "DATABASE_URL"] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({ code: "custom", path: [key], message: "required in production" });
      }
    }
    if (env.ALLOWED_ORIGINS === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOWED_ORIGINS"],
        message: "required in production",
      });
    } else if (env.ALLOWED_ORIGINS.includes("*")) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOWED_ORIGINS"],
        message: "a wildcard is refused in production",
      });
    }
  })
  .transform((env) => ({
    ...env,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS ?? ["*"],
    AUTH_JWKS_URL: env.AUTH_JWKS_URL ?? DEV_JWKS_URL,
    CHECKPOINT_KEY: env.CHECKPOINT_KEY ?? DEV_CHECKPOINT_KEY,
    DATABASE_URL: env.DATABASE_URL ?? DEV_DATABASE_URL,
    voice:
      env.VOICE_ENABLED === "true" &&
      env.LIVEKIT_URL !== undefined &&
      env.LIVEKIT_API_KEY !== undefined &&
      env.LIVEKIT_API_SECRET !== undefined
        ? { url: env.LIVEKIT_URL, apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET }
        : null,
  }));

export type Config = Readonly<z.infer<typeof envSchema> & { isProduction: boolean }>;

/** Exported for tests; the app uses `config`. */
export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const reasons = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(env)"}: ${issue.message}`,
    );
    throw new Error(`Invalid environment:\n${reasons.join("\n")}`);
  }
  return Object.freeze({ ...parsed.data, isProduction: parsed.data.NODE_ENV === "production" });
}
