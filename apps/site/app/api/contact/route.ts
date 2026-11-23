import { consumeContactRateLimit, contactSchema, createContactRequest, type ContactInput } from "@ugur/server";
import { NextResponse } from "next/server";
import { clientAddress } from "@/src/lib/client-address";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;
const ALLOWED_REDIRECT_PATHS = new Set(["/contact", "/de/contact"]);

export type ContactErrorCode = "invalid_input" | "rate_limited" | "server_error";

function getRedirectUrl(
  request: Request,
  params: { sent?: boolean; error?: ContactErrorCode }
): URL {
  const referer = request.headers.get("referer");
  let targetPath = "/contact";

  if (referer) {
    try {
      const refUrl = new URL(referer);
      const requestUrl = new URL(request.url);
      // Strictly restrict redirect targets to allowed same-origin contact routes
      if (refUrl.origin === requestUrl.origin && ALLOWED_REDIRECT_PATHS.has(refUrl.pathname)) {
        targetPath = refUrl.pathname;
      } else if (refUrl.pathname.startsWith("/de")) {
        targetPath = "/de/contact";
      }
    } catch {
      targetPath = "/contact";
    }
  }

  const target = new URL(targetPath, request.url);
  if (params.sent) {
    target.searchParams.set("sent", "true");
    target.searchParams.delete("error");
  } else if (params.error) {
    target.searchParams.set("error", params.error);
    target.searchParams.delete("sent");
  }
  return target;
}

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
  const isFormUrlEncoded = contentType === "application/x-www-form-urlencoded";
  const isMultipart = contentType === "multipart/form-data";
  const isJson = contentType === "application/json";

  if (!isJson && !isFormUrlEncoded && !isMultipart) {
    return NextResponse.json({ ok: false, error: "Content-Type must be application/json or form submission" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "Request is too large" }, { status: 413 });
  }

  let body: unknown;
  if (isJson) {
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
  } else {
    try {
      const formData = await request.formData();
      body = {
        name: formData.get("name") ?? "",
        email: formData.get("email") ?? "",
        message: formData.get("message") ?? "",
        nickname: formData.get("nickname") ?? "",
      };
    } catch {
      return NextResponse.redirect(getRedirectUrl(request, { error: "invalid_input" }), { status: 303 });
    }
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    if (!isJson) {
      return NextResponse.redirect(getRedirectUrl(request, { error: "invalid_input" }), { status: 303 });
    }
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const address = clientAddress(request.headers);
  if (!address) {
    if (!isJson) {
      return NextResponse.redirect(getRedirectUrl(request, { error: "server_error" }), { status: 303 });
    }
    return NextResponse.json({ ok: false, error: "Contact service temporarily unavailable" }, { status: 503 });
  }

  let limit: Awaited<ReturnType<typeof consumeContactRateLimit>>;
  try {
    limit = await consumeContactRateLimit(address);
  } catch {
    console.error("Contact rate limit unavailable");
    if (!isJson) {
      return NextResponse.redirect(getRedirectUrl(request, { error: "server_error" }), { status: 303 });
    }
    return NextResponse.json({ ok: false, error: "Contact service temporarily unavailable" }, { status: 503 });
  }
  if (!limit.allowed) {
    if (!isJson) {
      return NextResponse.redirect(getRedirectUrl(request, { error: "rate_limited" }), { status: 303 });
    }
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const id = await createContactRequest(parsed.data as ContactInput);
    if (!isJson) {
      return NextResponse.redirect(getRedirectUrl(request, { sent: true }), { status: 303 });
    }
    return NextResponse.json({ ok: true, id, status: "saved" });
  } catch {
    console.error("Failed to save contact request");
    if (!isJson) {
      return NextResponse.redirect(getRedirectUrl(request, { error: "server_error" }), { status: 303 });
    }
    return NextResponse.json({ ok: false, error: "Failed to save message" }, { status: 500 });
  }
}
