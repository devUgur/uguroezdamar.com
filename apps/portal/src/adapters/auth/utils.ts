import { cookies, headers } from "next/headers";
import { env } from "@ugur/server";
import { getAdminByEmail, getAdminSession, timingSafeEqualsString, type Admin, type AdminSession } from "@ugur/server/admin";

export type RequireAdminResult =
  | { ok: true; method: "bearer"; session?: never; admin?: never }
  | { ok: true; method: "session"; session: AdminSession; admin: Admin | null }
  | { ok: false; reason: "no_session" | "invalid_session"; method?: never; session?: never; admin?: never };

export async function readCookie(name: string): Promise<string | null> {
  try {
    const store = await cookies();
    const value = store.get(name)?.value;
    if (value) return value;
  } catch {
    // ignore and fallback to header parsing
  }

  try {
    const hdrs = await headers();
    const cookieHeader = hdrs.get("cookie") ?? "";
    if (!cookieHeader) return null;
    const match = cookieHeader.split("; ").find((entry: string) => entry.startsWith(`${name}=`));
    if (!match) return null;
    return match.split("=").slice(1).join("=") || null;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request): Promise<RequireAdminResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const key = env.ADMIN_API_KEY ?? "";
  if (token && key) {
    if (timingSafeEqualsString(token, key)) {
      return { ok: true, method: "bearer" };
    }
  }

  const sessionId = await readCookie("admin_session"); // Use the local readCookie
  if (!sessionId) return { ok: false, reason: "no_session" };
  const session = await getAdminSession(sessionId);
  if (!session) return { ok: false, reason: "invalid_session" };
  const admin = await getAdminByEmail(session.email);
  return { ok: true, method: "session", session, admin: admin ?? null };
}
