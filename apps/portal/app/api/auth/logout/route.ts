import { NextResponse, type NextRequest } from "next/server";
import { deleteAdminSession } from "@ugur/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("admin_session")?.value ?? null;
  if (sessionId) {
    await deleteAdminSession(sessionId);
  }

  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("admin_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "strict",
    secure,
  });
  return res;
}
