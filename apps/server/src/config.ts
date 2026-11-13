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

const envSchema = z
  .object({
    NODE_ENV: optional(z.enum(["development", "test", "production"])).default("development"),
    PORT: optional(z.coerce.number().int().min(1).max(65_535)).default(2567),
    ALLOWED_ORIGINS: originList,
    LOG_LEVEL: optional(z.enum(["fatal", "error", "warn", "info", "debug", "trace"])).default(
      "info",
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.ALLOWED_ORIGINS.includes("*")) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOWED_ORIGINS"],
        message: "a wildcard is refused in production",
      });
    }
  });

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
