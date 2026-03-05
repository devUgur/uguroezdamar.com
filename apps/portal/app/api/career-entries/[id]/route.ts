import { NextResponse, type NextRequest } from "next/server";
import { canDelete, getCareerEntryById, updateCareerEntry, deleteCareerEntry, UpdateCareerEntrySchema } from "@ugur/server";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";

export const runtime = "nodejs";

function getIdFromPath(pathname: string): string {
  const parts = pathname.split("/");
  return parts[parts.length - 1] ?? "";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = getIdFromPath(request.nextUrl.pathname);
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  try {
    const item = await getCareerEntryById(id);
    if (!item) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = getIdFromPath(request.nextUrl.pathname);
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateCareerEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const ok = await updateCareerEntry(id, parsed.data);
    if (!ok) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const actingAdmin = auth.method === "session" ? auth.admin : null;
  if (!canDelete(actingAdmin)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = getIdFromPath(request.nextUrl.pathname);
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  try {
    const ok = await deleteCareerEntry(id);
    if (!ok) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
