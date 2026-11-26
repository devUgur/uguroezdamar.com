import type { Env } from "../env.ts";
import { emit } from "../events.ts";

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

interface IssuePayload {
  action?: string;
  repository?: { full_name?: string };
  issue?: { number?: number; title?: string; body?: string | null; state?: "open" | "closed"; html_url?: string; updated_at?: string };
}

function issueFields(body: string | null | undefined): { description: string | null; acceptance: string | null } {
  const text = (body ?? "").replace(/\n?<!-- ugur-task:[^>]+ -->\s*$/, "").trim();
  const marker = "### Abnahmekriterien\n";
  const index = text.indexOf(marker);
  if (index < 0) return { description: text || null, acceptance: null };
  return { description: text.slice(0, index).trim() || null, acceptance: text.slice(index + marker.length).trim() || null };
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
    if (await env.CONFIG.get(`github:delivery:${delivery}`)) return reply(200, { ok: true, duplicate: true });
  }
  const markDelivery = () => delivery ? env.CONFIG.put(`github:delivery:${delivery}`, "1", { expirationTtl: DELIVERY_TTL_SECONDS }) : Promise.resolve();

  const event = request.headers.get("x-github-event");
  let payload: InstallationPayload = {};
  try {
    payload = JSON.parse(body) as InstallationPayload;
  } catch {
    return reply(400, { error: "Kein gültiges JSON" });
  }
  const id = payload.installation?.id;

  if (event === "ping") {
    await markDelivery();
    return reply(200, { ok: true });
  }

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
    await markDelivery();
    return reply(202, { ok: true, event, action: payload.action ?? null });
  }

  if (event === "issues" && ["opened", "edited", "closed", "reopened"].includes(payload.action ?? "")) {
    const issuePayload = payload as IssuePayload;
    const issue = issuePayload.issue;
    const repo = issuePayload.repository?.full_name?.toLowerCase();
    if (!issue?.number || !repo || !issue.updated_at) {
      await markDelivery();
      return reply(202, { ok: true, ignored: "incomplete_issue_payload" });
    }
    // Only tenants that connected the sending installation may be touched; the owner also keeps its hand-installed
    // app (no installation record). Two tenants with the same repository each get their own linked task updated.
    const { results: linked } = await env.DB.prepare(
      `/* tenant:platform */ SELECT t.id, t.tenant_id, t.project_id, t.github_issue_updated_at
         FROM tasks t JOIN projects p ON p.id = t.project_id AND p.tenant_id = t.tenant_id
        WHERE lower(p.repo) = ? AND t.github_issue_number = ?
          AND (t.tenant_id IN (SELECT tenant_id FROM tenant_installations WHERE installation_id = ? AND status = 'active')
               OR (t.tenant_id = 'owner' AND NOT EXISTS (SELECT 1 FROM tenant_installations WHERE installation_id = ?)))`,
    )
      .bind(repo, issue.number, id ?? -1, id ?? -1)
      .all<{ id: string; tenant_id: string; project_id: string | null; github_issue_updated_at: number | null }>();
    if (!linked.length) {
      await markDelivery();
      return reply(202, { ok: true, ignored: "unlinked_issue" });
    }
    const updatedAt = Math.floor(Date.parse(issue.updated_at) / 1000);
    const fields = issueFields(issue.body);
    let synced = 0;
    for (const task of linked) {
      if (task.github_issue_updated_at !== null && updatedAt <= task.github_issue_updated_at) continue;
      await env.DB.prepare(
        "UPDATE tasks SET title = ?, description = ?, acceptance_criteria = ?, github_issue_url = ?, github_issue_state = ?, github_issue_updated_at = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?",
      ).bind(issue.title?.slice(0, 200) ?? "GitHub Issue", fields.description?.slice(0, 10_000) ?? null,
        fields.acceptance?.slice(0, 5_000) ?? null, issue.html_url ?? null, issue.state ?? "open",
        updatedAt, task.tenant_id, task.id).run();
      await emit(env, {
        tenantId: task.tenant_id,
        taskId: task.id,
        projectId: task.project_id ?? undefined,
        type: "task_updated",
        data: { source: "github_issue", state: issue.state ?? "open", title: issue.title ?? null },
      });
      synced += 1;
    }
    await markDelivery();
    return reply(202, synced ? { ok: true, synced } : { ok: true, ignored: "stale_issue_update" });
  }

  await markDelivery();
  // Other events (push, pull_request, check_suite) are accepted and ignored until something consumes them.
  return reply(202, { ok: true, ignored: event ?? null });
}
