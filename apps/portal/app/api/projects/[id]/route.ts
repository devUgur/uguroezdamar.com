import { NextResponse, type NextRequest } from "next/server";
import { 
  canDelete, 
  getProjectById, 
  softDeleteProject, 
  updateProject, 
  UpdateProjectSchema,
  collectProjectAssetUrls,
  deleteObjectsByUrls,
  type ProjectRecord
} from "@ugur/server";
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
    const item = await getProjectById(id);
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
    const msg = parsed.error.issues
      .map((i) => (i.path.length ? i.path.join(".") : "field") + ": " + i.message)
      .join("; ");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  try {
    const existing = await getProjectById(id);
    if (!existing) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });

    const ok = await updateProject(id, parsed.data);
    if (!ok) return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });

    // Handle asset cleanup if images or apps changed
    if (parsed.data.images || parsed.data.coverImageUrl || parsed.data.apps) {
       const updated = await getProjectById(id);
       if (updated) {
          const beforeUrls = collectProjectAssetUrls(existing as ProjectRecord);
          const afterUrls = collectProjectAssetUrls(updated as ProjectRecord);
          const afterSet = new Set(afterUrls);
          const removedUrls = beforeUrls.filter((url) => !afterSet.has(url));

          if (removedUrls.length) {
            await deleteObjectsByUrls(removedUrls);
          }
       }
    }

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
    const ok = await softDeleteProject(id);
    if (!ok) return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
