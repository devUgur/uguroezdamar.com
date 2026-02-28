import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/shared/lib/env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") ?? "";

  if (!env.REVALIDATE_SECRET || secret !== env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const path = typeof record.path === "string" ? record.path : null;
  const tag = typeof record.tag === "string" ? record.tag : null;

  if (tag) revalidateTag(tag, "default");
  if (path) revalidatePath(path);

  return NextResponse.json({ ok: true, revalidated: { path, tag } });
}
