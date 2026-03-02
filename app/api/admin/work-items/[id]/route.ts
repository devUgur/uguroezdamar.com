import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, canDelete } from "@/features/admin";
import { getWorkItemBySlug, updateWorkItem as dbUpdateWorkItem, softDeleteWorkItem } from "@/features/work/server/mongo";
import { UpdateWorkItemSchema } from "@/features/work/server/validators";

export async function GET(request: NextRequest, context: any) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = context?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const work = await getWorkItemBySlug(id);
  if (!work) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, work });
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parts = request.nextUrl.pathname.split("/");
  const idVal = parts[parts.length - 1];

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateWorkItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const data = {
      ...parsed.data,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
    };
    const updated = await dbUpdateWorkItem(idVal, data as any);
    if (!updated) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err: unknown) {
    console.error("Error updating work item:", err);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actingAdmin = auth.method === "session" ? auth.admin : null;
  if (!canDelete(actingAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parts = request.nextUrl.pathname.split("/");
  const idVal = parts[parts.length - 1];

  try {
    const ok = await softDeleteWorkItem(idVal);
    if (!ok) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Error deleting work item:", err);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }
}
