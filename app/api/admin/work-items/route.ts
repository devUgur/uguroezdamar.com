import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/features/admin";
import { getWorkItems } from "@/features/work/server/repo";
import { CreateWorkItemSchema } from "@/features/work/server/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const items = await getWorkItems({ status });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = CreateWorkItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  // Ensure Mongo repo is available
  try {
    const { createWorkItem } = await import("@/features/work/server/mongo");
    const data = {
      ...parsed.data,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
    };
    const created = await createWorkItem(data);
    return NextResponse.json({ ok: true, item: created });
  } catch (err: unknown) {
    console.error("Error creating work item:", err);
    return NextResponse.json({ ok: false, error: "DB not configured or error creating item" }, { status: 500 });
  }
}
