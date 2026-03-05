import { NextResponse, type NextRequest } from "next/server";
import { CreateCareerEntrySchema, createCareerEntry, getCareerEntries } from "@ugur/server";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const visibility = url.searchParams.get("visibility") || undefined;

  try {
    const items = await getCareerEntries({ status, type, visibility });
    return NextResponse.json({ ok: true, items });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = CreateCareerEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  try {
    const item = await createCareerEntry(parsed.data);
    return NextResponse.json({ ok: true, item });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
