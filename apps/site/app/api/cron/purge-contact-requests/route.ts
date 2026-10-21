import { deleteExpiredContactRequests, timingSafeEqualsString } from "@ugur/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!secret || !timingSafeEqualsString(suppliedSecret, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const deleted = await deleteExpiredContactRequests();
    return NextResponse.json({ ok: true, deleted });
  } catch {
    // Do not log database errors: drivers may include SQL parameters in their messages.
    console.error("Contact retention job failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
