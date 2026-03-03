import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasAdminCookie(request: NextRequest) {
  return Boolean(request.cookies.get("admin_session")?.value);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin UI guard (cookie presence only)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!hasAdminCookie(request)) {
      // UX-friendly default: redirect to login and preserve the original URL
      // so the user can be returned to their intended page after login.
      const loginUrl = new URL("/admin/login", request.url);
      const nextParam = request.nextUrl.pathname + request.nextUrl.search;
      loginUrl.searchParams.set("next", nextParam);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Admin API guard (cookie presence only; full auth/DB checks happen in route handlers)
  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login")) {
    if (!hasAdminCookie(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
