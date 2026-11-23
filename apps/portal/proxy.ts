import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasAdminCookie(request: NextRequest) {
  return Boolean(request.cookies.get("admin_session")?.value);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isPublic = pathname === "/login" || pathname === "/signup";
  const isApi = pathname.startsWith("/api/");
  const isPublicApi = 
    pathname.startsWith("/api/auth/login") || 
    pathname.startsWith("/api/auth/invites/accept") ||
    pathname === "/api/health";

  // UI guard: Redirect to login if no cookie
  if (!isPublic && !isApi) {
    if (!hasAdminCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      const nextParam = request.nextUrl.pathname + request.nextUrl.search;
      loginUrl.searchParams.set("next", nextParam);
      return NextResponse.redirect(loginUrl);
    }
  }

  // API guard: without a session cookie or an API key there is nothing to check, so answer 401
  // here. Whether the cookie or the key is valid is decided by `requireAdmin` in the handler.
  const hasApiKey = request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
  if (isApi && !isPublicApi) {
    if (!hasAdminCookie(request) && !hasApiKey) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
