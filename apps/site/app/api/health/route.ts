import { pingDatabase } from "@ugur/server";
import { NextResponse } from "next/server";

import { clientAddress } from "@/src/lib/client-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness for the host and facts for `pnpm ugur smoke`: the deployed commit, whether the
 * database answers, and the client address the app derives — the caller's own, as the contact
 * rate limit will see it. Always 200 while the process serves: the content does not need the
 * database, so a database outage must not take the site out of rotation.
 */
export async function GET(request: Request) {
  return NextResponse.json(
    {
      ok: true,
      app: "site",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      database: (await pingDatabase()) ? "ok" : "unavailable",
      client: clientAddress(request.headers),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
