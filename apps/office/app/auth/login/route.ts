import { NextResponse, type NextRequest } from "next/server";
import { signInUrl } from "@/src/adapters/session";

/** Sign-in goes through the portal (ADR 0039): it checks its own session and sends a one-time ticket back. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(signInUrl(request.nextUrl.origin, request.nextUrl.searchParams.get("next") ?? "/"));
}
