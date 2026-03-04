import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/features/admin";
import { createProject, getProjects } from "@/features/projects/server/mongo";
import { CreateProjectSchema } from "@/features/projects/server/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const status = statusRaw === "draft" || statusRaw === "published" || statusRaw === "archived" ? statusRaw : undefined;

  try {
    const items = await getProjects({ status, includeDrafts: true, limit: 500 });
    return NextResponse.json({ ok: true, items });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const data = parsed.data;
    const project = await createProject({
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? "",
      content: data.content ?? "",
      tags: data.tags ?? [],
      kinds: data.kinds ?? [],
      tech: data.tech ?? [],
      links: data.links ?? [],
      images: data.images ?? [],
      coverImageUrl: data.coverImageUrl ?? null,
      previewImageUrl: data.previewImageUrl ?? null,
      status: data.status ?? "draft",
      featured: !!data.featured,
      isSecret: !!data.isSecret,
      sortIndex: data.sortIndex ?? 0,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    });

    return NextResponse.json({ ok: true, item: project });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
