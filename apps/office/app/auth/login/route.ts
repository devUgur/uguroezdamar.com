import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/src/adapters/session-token";
import { portalUrl } from "@/src/adapters/session";

/** Sign-in goes through the portal (ADR 0039): it checks its own session and sends a one-time ticket back. */
export function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const callback = new URL("/auth/callback", request.nextUrl.origin);
  callback.searchParams.set("next", next);
  const target = new URL("/office-handoff", portalUrl());
  target.searchParams.set("return", callback.toString());
  return NextResponse.redirect(target);
}
