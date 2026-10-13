import { pingDatabase } from "@ugur/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness for the host and facts for `pnpm ugur smoke`: the deployed commit and whether the
 * database answers. Always 200 while the process serves; restarting it does not fix a database.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      app: "portal",
      commit: process.env.RENDER_GIT_COMMIT ?? null,
      database: (await pingDatabase()) ? "ok" : "unavailable",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
