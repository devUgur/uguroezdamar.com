import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";
import { CreateProjectSchema, createProject, getProjects } from "@ugur/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const featuredRaw = url.searchParams.get("featured");
  const featured = featuredRaw === "true" ? true : featuredRaw === "false" ? false : undefined;

  try {
    const items = await getProjects({ status, featured, limit: 500 });
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
    const msg = parsed.error.issues
      .map((i) => (i.path.length ? i.path.join(".") : "field") + ": " + i.message)
      .join("; ");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  try {
    const project = await createProject(parsed.data);
    return NextResponse.json({ ok: true, item: project });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
