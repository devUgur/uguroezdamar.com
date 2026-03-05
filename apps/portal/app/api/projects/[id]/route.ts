import { NextResponse, type NextRequest } from "next/server";
import { canDelete, requireAdmin } from "@ugur/server";
import {
  UpdateProjectSchema,
  collectProjectAssetUrls,
  deleteObjectsByPrefix,
  deleteObjectsByUrls,
  getProjectBySlugMongo,
  softDeleteProject,
  updateProject,
  type DbProject,
} from "@ugur/server";

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
    const item = await getProjectBySlugMongo(id, { includeDrafts: true });
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
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const existing = await getProjectBySlugMongo(id, { includeDrafts: true });
    if (!existing) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });

    const data = parsed.data;
    const patch: Partial<DbProject> = {
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.tech !== undefined ? { tech: data.tech } : {}),
      ...(data.links !== undefined ? { links: data.links } : {}),
      ...(data.images !== undefined ? { images: data.images } : {}),
      ...(data.coverImageUrl !== undefined ? { coverImageUrl: data.coverImageUrl } : {}),
      ...(data.previewImageUrl !== undefined ? { previewImageUrl: data.previewImageUrl } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.featured !== undefined ? { featured: data.featured } : {}),
      ...(data.isSecret !== undefined ? { isSecret: data.isSecret } : {}),
      ...(data.sortIndex !== undefined ? { sortIndex: data.sortIndex } : {}),
      ...(data.publishedAt !== undefined ? { publishedAt: new Date(data.publishedAt) } : {}),
    };

    const item = await updateProject(id, patch);
    if (!item) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });

    const beforeUrls = collectProjectAssetUrls(existing);
    const afterUrls = collectProjectAssetUrls(item);
    const afterSet = new Set(afterUrls);
    const removedUrls = beforeUrls.filter((url) => !afterSet.has(url));

    if (removedUrls.length) {
      await deleteObjectsByUrls(removedUrls);
    }

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
    const existing = await getProjectBySlugMongo(id, { includeDrafts: true });
    if (!existing) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });

    const urls = collectProjectAssetUrls(existing);
    await deleteObjectsByUrls(urls);
    await deleteObjectsByPrefix(`project-assets/${existing.slug}/`);

    const ok = await softDeleteProject(id);
    if (!ok) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
