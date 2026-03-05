import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, getProjectById, updateProject, uploadBuffer } from "@ugur/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";

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
  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // Try to find a live link in the links array
  const liveLink = project.links?.find(l => l.platform.toLowerCase() === 'live' || l.label?.toLowerCase() === 'live')?.url 
    || project.links?.[0]?.url;

  if (!liveLink) return NextResponse.json({ ok: false, error: "Project has no live URL" }, { status: 400 });

  try {
    let previewUrl: string | null = null;

    if (!parsed.data.mode || parsed.data.mode === "og") {
      try {
        const res = await fetch(liveLink, { method: "GET", headers: { "user-agent": "UgurPreview/1.0" } });
        const text = await res.text();
        const m = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (m && m[1]) previewUrl = m[1];
      } catch {
        // ignore
      }
    }

    if (!previewUrl) {
      if (!env.SCREENSHOT_PROVIDER_URL) {
        return NextResponse.json({ ok: false, error: "No screenshot provider configured and no og:image found" }, { status: 400 });
      }
      const providerUrl = `${env.SCREENSHOT_PROVIDER_URL}?url=${encodeURIComponent(liveLink)}&width=1280&height=720` + (env.SCREENSHOT_API_KEY ? `&key=${env.SCREENSHOT_API_KEY}` : "");
      previewUrl = providerUrl;
    }

    let finalPreviewUrl = previewUrl;
    if (env.PREVIEW_USE_STORAGE === "r2") {
      try {
        const fetchRes = await fetch(previewUrl);
        if (!fetchRes.ok) throw new Error("Failed to fetch preview image");
        const contentType = fetchRes.headers.get("content-type") ?? "image/jpeg";
        const buf = Buffer.from(await fetchRes.arrayBuffer());
        const key = `project-previews/${(project.slug || id).replace(/[^a-zA-Z0-9-_\.]/g, "_")}-${Date.now()}.jpg`;
        const uploadedUrl = await uploadBuffer(buf, key, contentType);
        finalPreviewUrl = uploadedUrl;
      } catch {
        finalPreviewUrl = previewUrl;
      }
    }

    const ok = await updateProject(id, { previewImageUrl: finalPreviewUrl, previewUpdatedAt: new Date().toISOString() });
    if (!ok) return NextResponse.json({ ok: false, error: "Failed to persist preview" }, { status: 500 });

    try {
      revalidatePath(`/work/${project.slug}`);
      revalidatePath(`/projects/${project.slug}`);
      revalidatePath(`/work`);
      revalidatePath(`/projects`);
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, url: finalPreviewUrl });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Internal error" }, { status: 500 });
  }
}
