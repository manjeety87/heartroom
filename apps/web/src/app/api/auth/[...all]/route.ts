import { getAuth } from "@/lib/auth/server";

/** Better Auth's endpoints: anonymous sign-in, session, `/token` and `/jwks` for the game server. */
async function handle(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
