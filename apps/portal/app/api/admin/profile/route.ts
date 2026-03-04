import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/features/admin";
import { getProfile, UpsertProfileSchema, upsertProfile } from "@ugur/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const handle = request.nextUrl.searchParams.get("handle") ?? "main";
  try {
    const profile = await getProfile(handle);
    return NextResponse.json({ ok: true, profile });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = UpsertProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const profile = await upsertProfile(data.handle, {
      headline: data.headline,
      subheadline: data.subheadline ?? null,
      bio: data.bio,
      location: data.location ?? null,
      email: data.email ?? null,
      links: {
        github: data.links?.github ?? null,
        linkedin: data.links?.linkedin ?? null,
        website: data.links?.website ?? null,
      },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message ?? "Failed" }, { status: 500 });
  }
}
