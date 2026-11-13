/** True when a browser's `Origin` header is on the allow list. A missing Origin is refused too. */
export function isAllowedOrigin(origin: string | null, allowed: readonly string[]): boolean {
  if (allowed.includes("*")) return true;
  return origin !== null && allowed.includes(origin);
}
