import { consumeContactRateLimit, contactSchema, createContactRequest, type ContactInput } from "@ugur/server";
import { NextResponse } from "next/server";
import { clientAddress } from "@/src/lib/client-address";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });
    }
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json({ ok: false, error: "Content-Type must be application/json" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "Request is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    if (!request.body) throw new Error("Missing request body");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return NextResponse.json({ ok: false, error: "Request is too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const address = clientAddress(request.headers);
  if (!address) {
    return NextResponse.json({ ok: false, error: "Contact service temporarily unavailable" }, { status: 503 });
  }

  let limit: Awaited<ReturnType<typeof consumeContactRateLimit>>;
  try {
    limit = await consumeContactRateLimit(address);
  } catch {
    console.error("Contact rate limit unavailable");
    return NextResponse.json({ ok: false, error: "Contact service temporarily unavailable" }, { status: 503 });
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const id = await createContactRequest(parsed.data as ContactInput);
    return NextResponse.json({ ok: true, id, status: "saved" });
  } catch (error) {
    console.error("Failed to save contact request:", error);
    return NextResponse.json({ ok: false, error: "Failed to save message" }, { status: 500 });
  }
}
