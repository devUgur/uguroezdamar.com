import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/apps/portal/src/adapters/auth/utils";
import { buildProjectAssetKey, env, uploadBuffer } from "@ugur/server";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const PROJECT_KINDS = new Set(["web", "mobile", "desktop", "cli"]);

function matchesImageType(bytes: Uint8Array, contentType: string) {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  switch (contentType) {
    case "image/avif":
      return bytes.length >= 12 && ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4));
    case "image/gif":
      return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6));
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
    case "image/webp":
      return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (env.PREVIEW_USE_STORAGE !== "r2") {
    return NextResponse.json({ ok: false, error: "R2 storage is not enabled" }, { status: 400 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: "Upload exceeds the 10 MB limit" }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const slug = String(formData.get("slug") ?? "project");
    const kind = formData.get("kind");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be between 1 byte and 10 MB" }, { status: 413 });
    }
    const extension = IMAGE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json({ ok: false, error: "Unsupported image type" }, { status: 415 });
    }
    if (typeof kind === "string" && kind.trim() && !PROJECT_KINDS.has(kind.trim())) {
      return NextResponse.json({ ok: false, error: "Invalid project kind" }, { status: 400 });
    }

    const subPath = typeof kind === "string" && kind.trim() ? kind.trim() : undefined;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (!matchesImageType(bytes, file.type)) {
      return NextResponse.json({ ok: false, error: "Image content does not match its declared type" }, { status: 415 });
    }
    const key = buildProjectAssetKey(slug || "project", `upload.${extension}`, subPath);
    const buffer = Buffer.from(bytes);
    const contentType = file.type;

    const url = await uploadBuffer(buffer, key, contentType, {
      cacheControl: "public, max-age=31536000, immutable",
    });

    return NextResponse.json({ ok: true, url, key });
  } catch {
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
