import type { Env } from "./env.ts";

export interface Caller {
  /** Email of the portal admin on whose behalf the portal calls; for audit only. */
  actor: string;
}

/**
 * Fail closed: only the portal server may call the API. It sends the shared service token as a
 * bearer token and names the signed-in admin in `x-portal-actor`. Without a configured token
 * nothing passes. The token is accepted only in the Authorization header, never in a URL.
 */
export async function authorize(request: Request, env: Env): Promise<Caller | null> {
  const expected = env.API_SERVICE_TOKEN;
  if (!expected) return null;
  const header = request.headers.get("authorization");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!given || !(await constantTimeEqual(given, expected))) return null;
  return { actor: (request.headers.get("x-portal-actor") ?? "portal").slice(0, 200) };
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}
