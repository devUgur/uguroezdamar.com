import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/src/adapters/session";

/** Ends the office session only; the portal session stays as it is. */
export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/signed-out", request.nextUrl.origin), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
