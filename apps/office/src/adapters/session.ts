import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext, SESSION_TTL_MS, signSession, verifySession, type OfficeSession } from "./session-token";

export const SESSION_COOKIE = "office_session";

function secret(): string {
  return process.env.API_SERVICE_TOKEN ?? "";
}

/** The signed-in person, or null. Server Actions and pages check this themselves. */
export async function getCurrentSession(): Promise<OfficeSession | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, secret());
}

/**
 * Pages: without a session the sign-in through the portal takes over. The redirect goes straight to the portal
 * (an absolute URL), so a client-side navigation turns into a full page load instead of a blocked cross-origin fetch.
 */
export async function requireSession(next = "/"): Promise<OfficeSession> {
  const session = await getCurrentSession();
  if (!session) {
    const list = await headers();
    const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3102";
    const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    redirect(signInUrl(`${protocol}://${host}`, next));
  }
  return session;
}

/** The portal's handoff for this office: it signs in there and returns to /auth/callback with a one-time ticket. */
export function signInUrl(officeOrigin: string, next: string): string {
  const callback = new URL("/auth/callback", officeOrigin);
  callback.searchParams.set("next", safeNext(next));
  const target = new URL("/office-handoff", portalUrl());
  target.searchParams.set("return", callback.toString());
  return target.toString();
}

export async function startSession(identity: { actor: string; canManage: boolean }): Promise<{ value: string; maxAge: number }> {
  const value = await signSession({ email: identity.actor, canManage: identity.canManage, exp: Date.now() + SESSION_TTL_MS }, secret());
  return { value, maxAge: SESSION_TTL_MS / 1000 };
}

/** Where the office signs in: the portal of the same stage (wrangler vars, locally the portal on :3101). */
export function portalUrl(): string {
  return (process.env.PORTAL_URL ?? "http://localhost:3101").replace(/\/+$/, "");
}
