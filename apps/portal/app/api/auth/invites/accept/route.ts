import { NextResponse, type NextRequest } from "next/server";
import { AcceptAdminInviteSchema, acceptAdminInvite } from "@ugur/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = AcceptAdminInviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });

  const { token, password } = parsed.data;
  try {
    const res = await acceptAdminInvite(token, password);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Internal error" }, { status: 500 });
  }
}
