/**
 * The address a request really came from, for per-IP rate limits. Colyseus takes the *first*
 * `X-Forwarded-For` (or `X-Real-IP`) entry, which the client writes itself, so a limit keyed on it
 * can be dodged by sending a new header each time.
 *
 * Behind `trustProxy` proxies (Fly, Railway: 1), each proxy appends the address it saw, so the entry
 * `trustProxy` places from the right is the last one a trusted proxy wrote: the real client.
 * With no proxy (development), nothing in the headers is trusted and Colyseus's own guess is used;
 * production requires `TRUST_PROXY` (config.ts).
 */
export function clientIp(
  headers: Headers | undefined,
  colyseusGuess: string | undefined,
  trustProxy: number,
): string {
  if (trustProxy > 0) {
    const hops = (headers?.get("x-forwarded-for") ?? "")
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const real = hops[hops.length - trustProxy];
    if (real !== undefined) return real;
    // Fewer hops than proxies: the request didn't come through them. One shared bucket for those.
    return "unknown";
  }
  return colyseusGuess ?? "unknown";
}
