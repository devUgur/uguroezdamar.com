import { NextResponse, type NextRequest } from "next/server";
import { getAdminById } from "@ugur/server";
import { AgentsApiError, agentsApi } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import { isOfficeCallback } from "@/src/adapters/office";

/**
 * Sign-in for the office app (ADR 0039). The portal checks its own admin session, asks the agent API for a
 * one-time ticket for this person and sends it to the office's callback. Without a session the login comes first.
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("return");
  if (!isOfficeCallback(target)) return new NextResponse("Unbekanntes Ziel für die Anmeldung.", { status: 400 });
  const session = await getCurrentSession();
  if (!session) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  const admin = await getAdminById(session.adminId);
  const canManage = admin?.role === "owner" && admin.status === "active";
  try {
    const { ticket } = await agentsApi<{ ticket: string }>("/api/auth/handoff", session.email, { method: "POST", body: { canManage } });
    const callback = new URL(target);
    callback.searchParams.set("ticket", ticket);
    return NextResponse.redirect(callback);
  } catch (error) {
    const message = error instanceof AgentsApiError ? error.message : "Agenten-API nicht erreichbar.";
    console.error("office handoff failed", message);
    return new NextResponse(`Anmeldung im Office nicht möglich: ${message}`, { status: 502 });
  }
}
