import { getAuth } from "@/lib/auth/server";

/** Better Auth's endpoints: anonymous sign-in, session, `/token` and `/jwks` for the game server. */
function handle(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export { handle as GET, handle as POST };
