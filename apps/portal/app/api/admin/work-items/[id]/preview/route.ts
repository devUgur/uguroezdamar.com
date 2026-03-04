import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/admin";
import { env, getWorkItemBySlug, type DbWork, updateWorkItem, uploadBuffer } from "@ugur/server";
import { revalidatePath } from "next/cache";

const BodySchema = z.object({ mode: z.enum(["og", "screenshot"]).optional() });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });

  const id = params?.id;
  // find work item
  const work = await getWorkItemBySlug(id);
  if (!work) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const live = work.links?.live;
  if (!live) return NextResponse.json({ ok: false, error: "Work item has no live URL" }, { status: 400 });

  try {
    // Try OG image first
    let previewUrl: string | null = null;

    if (!parsed.data.mode || parsed.data.mode === "og") {
      try {
        const res = await fetch(live, { method: "GET", headers: { "user-agent": "ViralSync-Preview/1.0" } });
        const text = await res.text();
        const m = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (m && m[1]) previewUrl = m[1];
      } catch {
        // ignore
      }
    }

    // Fallback to screenshot provider if no og:image
    if (!previewUrl) {
      if (!env.SCREENSHOT_PROVIDER_URL) {
        return NextResponse.json({ ok: false, error: "No screenshot provider configured and no og:image found" }, { status: 400 });
      }
      // Construct provider url (provider-specific query params may be needed)
      const providerUrl = `${env.SCREENSHOT_PROVIDER_URL}?url=${encodeURIComponent(live)}&width=1280&height=720` + (env.SCREENSHOT_API_KEY ? `&key=${env.SCREENSHOT_API_KEY}` : "");
      previewUrl = providerUrl;
    }

    // If storage backend is enabled, fetch the image and upload to R2
    let finalPreviewUrl = previewUrl;
    if (env.PREVIEW_USE_STORAGE === "r2") {
      try {
        const fetchRes = await fetch(previewUrl);
        if (!fetchRes.ok) throw new Error("Failed to fetch preview image");
        const contentType = fetchRes.headers.get("content-type") ?? "image/jpeg";
        const buf = Buffer.from(await fetchRes.arrayBuffer());
        const key = `work-previews/${(work.slug || id).replace(/[^a-zA-Z0-9-_\.]/g, "_")}-${Date.now()}.jpg`;
        const uploadedUrl = await uploadBuffer(buf, key, contentType);
        finalPreviewUrl = uploadedUrl;
      } catch {
        // fallback to provider URL if upload fails
        finalPreviewUrl = previewUrl;
      }
    }

    // Persist preview url
    const now = new Date();
    const updateInput: Partial<DbWork> = { previewImageUrl: finalPreviewUrl, previewUpdatedAt: now };
    const updated = await updateWorkItem(id, updateInput);
    if (!updated) return NextResponse.json({ ok: false, error: "Failed to persist preview" }, { status: 500 });

    try {
      // Revalidate public pages so the preview appears immediately
      try {
        revalidatePath(`/work/${updated.slug}`);
        revalidatePath(`/work`);
      } catch {
        // ignore revalidation errors in dev
      }
    } catch {
      // noop
    }

    return NextResponse.json({ ok: true, previewImageUrl: finalPreviewUrl });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Internal error" }, { status: 500 });
  }
}
