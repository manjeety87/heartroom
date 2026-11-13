import { pino } from "pino";

/** Keys that may hold secrets or hidden game data. Payloads are never logged, only type and size. */
const REDACT = [
  "*.token",
  "*.authorization",
  "*.cookie",
  "*.checkpoint",
  "*.seed",
  "*.state",
  "*.secretWord",
  "*.grid",
  "req.headers",
];

export function createLogger(level: string) {
  return pino({ level, redact: { paths: REDACT, censor: "[redacted]" } });
}

export type Logger = ReturnType<typeof createLogger>;
