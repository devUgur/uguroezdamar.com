import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { listLeads } from "@ugur/server";
import { requireAdmin } from "@/features/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;

    const result = await listLeads({ limit, cursor, q });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
