import { matchMaker, ServerError } from "@colyseus/core";
import { ERROR_MESSAGES, type JoinError } from "@heartroom/protocol";
import { clientIp } from "./client-ip.ts";
import type { Logger } from "./logger.ts";
import { createRateLimiter } from "./rooms/rate-limit.ts";

/**
 * Colyseus's matchmaking routes, narrowed to what Heartroom uses:
 *
 * - Only `create`, `joinById` and `reconnect`. Its `join` / `joinOrCreate` put you in *any* open
 *   room, and rooms are private by code (design doc: no public matchmaking).
 * - A per-IP limit before Colyseus looks a code up. A code that doesn't exist is answered before
 *   the room's `onAuth` (and its join limits) ever runs, so without this anyone could try codes
 *   as fast as they like. `reconnect` is exempt: it needs a token the server gave that socket.
 *
 * Patches the one shared controller, so it runs once at boot, before `listen`.
 */
export const MATCHMAKING_METHODS = ["create", "joinById", "reconnect"];

export function guardMatchmaking(options: {
  readonly trustProxy: number;
  readonly log: Logger;
  /** Matchmaking calls per IP per minute; tests lower it. */
  readonly perMinute?: number;
}): void {
  const { controller } = matchMaker;
  controller.exposedMethods = [...MATCHMAKING_METHODS];
  const perIp = createRateLimiter({ capacity: options.perMinute ?? 30, windowMs: 60_000 });
  const invoke = controller.invokeMethod.bind(controller);
  controller.invokeMethod = (method, roomName, clientOptions, auth) => {
    if (method !== "reconnect") {
      const ip = clientIp(auth?.headers, auth?.ip, options.trustProxy);
      if (!perIp.take(ip)) {
        options.log.warn({ event: "matchmake_rate_limited", method }, "matchmake_rate_limited");
        const body: JoinError = { code: "RATE_LIMITED", message: ERROR_MESSAGES.RATE_LIMITED };
        return Promise.reject(new ServerError(429, JSON.stringify(body)));
      }
    }
    return invoke(method, roomName, clientOptions, auth);
  };
}
