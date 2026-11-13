/**
 * Who is connecting. Until Better Auth lands (Phase 2a #23) the only accepted token is a development
 * one, `dev:<id>`, and it is refused in production, so a deployed server lets nobody in rather than
 * trusting a name the browser made up. #23 replaces the dev branch with a JWT check (jose + JWKS).
 */
const DEV_TOKEN = /^dev:([A-Za-z0-9_-]{1,64})$/;

export type Identity = { readonly userId: string };

export function verifyToken(
  token: string | undefined,
  options: { readonly isProduction: boolean },
): Identity | null {
  if (options.isProduction || token === undefined) return null;
  const match = DEV_TOKEN.exec(token);
  return match?.[1] === undefined ? null : { userId: `dev-${match[1]}` };
}
