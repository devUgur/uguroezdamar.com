import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { listLeads } from "@ugur/server";
import { requireAdmin } from "@ugur/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 5000);
    const q = url.searchParams.get("q") ?? undefined;

    const { items } = await listLeads({ limit, q });

    // Build CSV
    const header = ["id", "name", "email", "message", "createdAt", "source"];
    const rows = items.map((r) => [r.id, r.name, r.email, (r.message || "").replace(/\r?\n/g, " "), r.createdAt, r.source ?? ""]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
