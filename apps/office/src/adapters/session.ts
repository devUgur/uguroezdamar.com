import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_TTL_MS, signSession, verifySession, type OfficeSession } from "./session-token";

export const SESSION_COOKIE = "office_session";

function secret(): string {
  return process.env.API_SERVICE_TOKEN ?? "";
}

/** The signed-in person, or null. Server Actions and pages check this themselves. */
export async function getCurrentSession(): Promise<OfficeSession | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, secret());
}

/** Pages: without a session the sign-in through the portal takes over. */
export async function requireSession(next = "/"): Promise<OfficeSession> {
  const session = await getCurrentSession();
  if (!session) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function startSession(identity: { actor: string; canManage: boolean }): Promise<{ value: string; maxAge: number }> {
  const value = await signSession({ email: identity.actor, canManage: identity.canManage, exp: Date.now() + SESSION_TTL_MS }, secret());
  return { value, maxAge: SESSION_TTL_MS / 1000 };
}

/** Where the office signs in: the portal of the same stage (wrangler vars, locally the portal on :3101). */
export function portalUrl(): string {
  return (process.env.PORTAL_URL ?? "http://localhost:3101").replace(/\/+$/, "");
}
