import { deleteContactRequest, markContactRequestProcessed } from "@ugur/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/adapters/auth/utils";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function authorize(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return false;
  if (auth.method === "bearer") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  if (!/^\d{1,15}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const expiresAt = await markContactRequestProcessed(id);
    return NextResponse.json(
      { ok: expiresAt !== null, expiresAt: expiresAt?.toISOString() },
      { status: expiresAt ? 200 : 404 },
    );
  } catch {
    console.error("Contact request processing update failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  if (!/^\d{1,15}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const deleted = await deleteContactRequest(id);
    return NextResponse.json({ ok: deleted }, { status: deleted ? 200 : 404 });
  } catch {
    console.error("Contact request erasure failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
