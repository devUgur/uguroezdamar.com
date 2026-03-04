import { NextResponse, type NextRequest } from "next/server";
import { deleteAdminSession } from "@ugur/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("admin_session")?.value ?? null;
  if (sessionId) {
    await deleteAdminSession(sessionId);
  }

  const res = NextResponse.redirect(new URL("/admin/login", request.url));
  // Delete cookie
  // Clear the cookie by setting an empty value and immediate expiry
  res.cookies.set("admin_session", "", { path: "/", maxAge: 0 });
  return res;
}
