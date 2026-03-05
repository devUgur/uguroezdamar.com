import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";
import { deleteObjectByUrl } from "@ugur/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url) return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });

  try {
    const deleted = await deleteObjectByUrl(url);
    return NextResponse.json({ ok: true, deleted });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Delete failed" }, { status: 500 });
  }
}
