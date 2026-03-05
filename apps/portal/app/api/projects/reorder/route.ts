import { NextResponse, type NextRequest } from "next/server";
import { reorderProjects } from "@ugur/server/projects/repo";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: { projectIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const projectIds = Array.isArray(body.projectIds)
    ? body.projectIds.filter((id): id is string => typeof id === "string")
    : [];
  if (projectIds.length === 0) {
    return NextResponse.json({ ok: false, error: "projectIds required (non-empty array)" }, { status: 400 });
  }

  try {
    await reorderProjects(projectIds);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message ?? "Reorder failed" },
      { status: 500 }
    );
  }
}
