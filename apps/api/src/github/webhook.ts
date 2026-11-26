import type { Env } from "../env.ts";

/**
 * GitHub webhook receiver (ADR 0032). The one thing it must never do is trust a request that is not
 * from GitHub: the signature (HMAC-SHA256 over the raw body with the shared secret) is checked first, in
 * constant time, and a missing secret rejects everything. Deliveries are deduplicated by their id, because
 * GitHub redelivers. It answers fast and does little: it keeps the installation records and caches current.
 */
const encoder = new TextEncoder();
const DELIVERY_TTL_SECONDS = 86_400;

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** True when `signature` ("sha256=<hex>") is the HMAC of `body` under `secret`. */
export async function validSignature(secret: string, body: string, signature: string | null): Promise<boolean> {
  const match = signature?.match(/^sha256=([0-9a-f]{64})$/);
  if (!match) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const given = match[1] ?? "";
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(expected)), crypto.subtle.digest("SHA-256", encoder.encode(given))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

interface InstallationPayload {
  action?: string;
  installation?: { id?: number; repository_selection?: string };
}

const STATUS_OF_ACTION: Record<string, string> = { deleted: "deleted", suspend: "suspended", unsuspend: "active" };

export async function handleGithubWebhook(request: Request, env: Env): Promise<Response> {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (request.method !== "POST") return reply(405, { error: "POST erwartet" });
  if (!env.AGENT_GH_WEBHOOK_SECRET) return reply(503, { error: "Webhook ist nicht eingerichtet" });

  const body = await request.text();
  if (!(await validSignature(env.AGENT_GH_WEBHOOK_SECRET, body, request.headers.get("x-hub-signature-256")))) {
    return reply(401, { error: "Signatur ungültig" });
  }

  const delivery = request.headers.get("x-github-delivery") ?? "";
  if (delivery) {
    const key = `github:delivery:${delivery}`;
    if (await env.CONFIG.get(key)) return reply(200, { ok: true, duplicate: true });
    await env.CONFIG.put(key, "1", { expirationTtl: DELIVERY_TTL_SECONDS });
  }

  const event = request.headers.get("x-github-event");
  let payload: InstallationPayload = {};
  try {
    payload = JSON.parse(body) as InstallationPayload;
  } catch {
    return reply(400, { error: "Kein gültiges JSON" });
  }
  const id = payload.installation?.id;

  if (event === "ping") return reply(200, { ok: true });

  if ((event === "installation" || event === "installation_repositories") && typeof id === "number") {
    const status = event === "installation" ? STATUS_OF_ACTION[payload.action ?? ""] : undefined;
    const selection = payload.installation?.repository_selection;
    // Installation ids are the primary key across all tenants; the record carries its tenant, so no tenant filter here.
    await env.DB.prepare(
      `/* tenant:platform */ UPDATE tenant_installations SET status = COALESCE(?, status), selection = COALESCE(?, selection) WHERE installation_id = ?`,
    )
      .bind(status ?? null, selection ?? null, id)
      .run();
    // A removed or suspended installation loses its access at once; others re-read the list and mint a new token.
    await Promise.all([env.CONFIG.delete("github:installations"), env.CONFIG.delete(`github:token:${id}`)]);
    return reply(202, { ok: true, event, action: payload.action ?? null });
  }

  // Other events (push, pull_request, check_suite) are accepted and ignored until something consumes them.
  return reply(202, { ok: true, ignored: event ?? null });
}
