import { NextResponse, type NextRequest } from "next/server";
import { canDelete, requireAdmin } from "@ugur/server";
import { getTimelineItemById, softDeleteTimelineItem, UpdateTimelineItemSchema, updateTimelineItem } from "@ugur/server";

export const runtime = "nodejs";

function normalizeTimelineType(type: "work" | "education" | "experience") {
  return type === "experience" ? "work" : type;
}

function visibilityFromType(type: "work" | "education") {
  return {
    about: type === "work",
    education: type === "education",
  };
}

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
    const item = await getTimelineItemById(id);
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
  const parsed = UpdateTimelineItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const data = parsed.data;
    const normalizedType = data.type ? normalizeTimelineType(data.type) : undefined;
    const patch = {
      ...(normalizedType ? { type: normalizedType } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.organization !== undefined ? { organization: data.organization } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
      ...(data.isCurrent !== undefined ? { isCurrent: data.isCurrent } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.highlights !== undefined ? { highlights: data.highlights } : {}),
      ...(data.sortIndex !== undefined ? { sortIndex: data.sortIndex } : {}),
      ...(normalizedType ? { visibility: visibilityFromType(normalizedType) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    };

    const item = await updateTimelineItem(id, patch);
    if (!item) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
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
    const ok = await softDeleteTimelineItem(id);
    if (!ok) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
