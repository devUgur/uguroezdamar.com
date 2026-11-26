import { NextResponse, type NextRequest } from "next/server";
import { AgentsApiError, agentsApi } from "@/src/adapters/agents-api";
import { SESSION_COOKIE, startSession } from "@/src/adapters/session";
import { safeNext } from "@/src/adapters/session-token";

/** Redeems the portal's ticket once at the agent API and starts the office's own session. */
export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket") ?? "";
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  try {
    const identity = await agentsApi<{ actor: string; canManage: boolean }>("/api/auth/handoff/redeem", "office", { method: "POST", body: { ticket } });
    const session = await startSession(identity);
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
    response.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    const message = error instanceof AgentsApiError ? error.message : "Anmeldung fehlgeschlagen.";
    console.error("office sign-in failed", message);
    return new NextResponse(`Anmeldung fehlgeschlagen: ${message} Bitte erneut über /auth/login anmelden.`, { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
