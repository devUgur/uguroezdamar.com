import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/features/admin";
import { createTimelineItem, getTimelineItems } from "@/features/timeline/server/mongo";
import { CreateTimelineItemSchema } from "@/features/timeline/server/validators";

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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const typeRaw = url.searchParams.get("type");
  const visibilityRaw = url.searchParams.get("visibility");

  const status = statusRaw === "draft" || statusRaw === "published" ? statusRaw : undefined;
  const type = typeRaw === "work" || typeRaw === "education" ? typeRaw : undefined;
  const visibility = visibilityRaw === "about" || visibilityRaw === "education" ? visibilityRaw : undefined;

  try {
    const items = await getTimelineItems({ status, type, visibility });
    return NextResponse.json({ ok: true, items });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = CreateTimelineItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const data = parsed.data;
    const type = normalizeTimelineType(data.type);

    const item = await createTimelineItem({
      type,
      title: data.title,
      organization: data.organization,
      location: data.location ?? null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      isCurrent: !!data.isCurrent,
      description: data.description ?? null,
      highlights: data.highlights ?? [],
      sortIndex: data.sortIndex ?? 0,
      visibility: visibilityFromType(type),
      status: data.status ?? "draft",
    });

    return NextResponse.json({ ok: true, item });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
