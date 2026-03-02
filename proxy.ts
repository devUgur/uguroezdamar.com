import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/features/admin";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV !== "production";

  // Protect all /admin routes
  if (pathname.startsWith("/admin")) {
    // 1. Allow access to login page
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    // 2. Check for admin session
    const sessionId = request.cookies.get("admin_session")?.value;
    const session = sessionId ? await getAdminSession(sessionId) : null;

    if (!session) {
      // STEALTH MODE: Rewrite to a non-existent path to trigger the site's own 404 page
      // This makes the response look exactly like any other 404 on the site.
      return NextResponse.rewrite(new URL("/_404_stealth_hidden_" + Math.random(), request.url));
    }
  }

  // Protect admin API routes (except login)
  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login")) {
    // In development, allow API access so local testing (Postman/curl) works.
    if (isDev) return NextResponse.next();

    const sessionId = request.cookies.get("admin_session")?.value;
    const session = sessionId ? await getAdminSession(sessionId) : null;

    if (!session) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
