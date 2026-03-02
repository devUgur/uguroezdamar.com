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
      // UX-friendly default: redirect to login so developers can see why they're blocked.
      // This is deterministic and debuggable. If you prefer stealth behavior in
      // production, we can gate it behind an env var later.
      return NextResponse.redirect(new URL("/admin/login", request.url));
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
