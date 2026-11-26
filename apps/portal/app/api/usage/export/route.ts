import { NextResponse, type NextRequest } from "next/server";
import { exportUsageCsv } from "@/src/features/usage";

export const dynamic = "force-dynamic";

/** CSV download of the usage ledger; the browser never sees the API's service token. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const response = await exportUsageCsv({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    project: params.get("project") ?? undefined,
    agent: params.get("agent") ?? undefined,
    provider: params.get("provider") ?? undefined,
    model: params.get("model") ?? undefined,
  });
  return response ?? NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
}
