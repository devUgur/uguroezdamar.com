import type { Env } from "./env.ts";
import { OWNER_TENANT } from "./tenancy.ts";

export interface Caller {
  /** Email of the portal admin on whose behalf the portal calls; for audit only. */
  actor: string;
  /** The customer this call is for. Until customers sign in (ADR 0032, stage 3) every call is the owner's. */
  tenantId: string;
  /** Narrow capabilities asserted by the trusted portal server after checking its admin session. */
  scopes: readonly string[];
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
  const allowedScopes = new Set(["organization:write", "providers:write"]);
  const scopes = (request.headers.get("x-portal-scopes") ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => allowedScopes.has(scope));
  return { actor: (request.headers.get("x-portal-actor") ?? "portal").slice(0, 200), tenantId: OWNER_TENANT, scopes };
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}
