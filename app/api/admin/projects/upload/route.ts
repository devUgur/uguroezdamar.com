import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/features/admin";
import { env } from "@/shared/lib/env";
import { uploadBuffer } from "@/shared/lib/storage";

export const runtime = "nodejs";

function sanitizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (env.PREVIEW_USE_STORAGE !== "r2") {
    return NextResponse.json({ ok: false, error: "R2 storage is not enabled" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const slug = String(formData.get("slug") ?? "project");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }

    const safeSlug = sanitizeSlug(slug || "project");
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const key = `project-assets/${safeSlug}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || "application/octet-stream";

    const url = await uploadBuffer(buffer, key, contentType, {
      cacheControl: "public, max-age=31536000, immutable",
    });

    return NextResponse.json({ ok: true, url, key });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Upload failed" }, { status: 500 });
  }
}
