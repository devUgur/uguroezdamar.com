import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { knowledgeStatus, search } from "./store.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export function indexerStub(env: Env, tenantId: string, projectId: string) {
  return env.INDEXER.get(`${tenantId}:${projectId}`);
}

interface ProjectRow {
  id: string;
  repo: string | null;
  default_branch: string;
  write_mode: string;
}

/** The branch the index follows: dev for dev-first projects (where the agents work), else the default branch. */
export function indexRef(project: ProjectRow): string {
  return project.write_mode === "dev-first" ? "dev" : project.default_branch;
}

/** Knowledge index and working memory of a project: status, re-index, search, memories. */
export async function handleKnowledge(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  const match = path.match(/^\/api\/projects\/([a-z0-9-]{1,40})\/(knowledge|knowledge\/reindex|knowledge\/search|memory)$/);
  if (!match) return null;
  const [, projectId = "", action] = match;
  const project = await env.DB.prepare("SELECT id, repo, default_branch, write_mode FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'")
    .bind(caller.tenantId, projectId)
    .first<ProjectRow>();
  if (!project) return json({ error: "Projekt nicht gefunden." }, 404);

  if (action === "knowledge" && request.method === "GET") {
    const [status, job] = await Promise.all([knowledgeStatus(env, caller.tenantId, projectId), indexerStub(env, caller.tenantId, projectId).status()]);
    return json({ ...status, job: job ? { status: job.status, indexed: job.indexed, skipped: job.skipped, queued: job.queue.length, vectorsMissing: job.vectorsMissing, startedAt: job.startedAt, finishedAt: job.finishedAt ?? null, error: job.error ?? null } : null });
  }
  if (action === "knowledge/reindex" && request.method === "POST") {
    if (!project.repo) return json({ error: "Das Projekt hat kein Repository." }, 400);
    const job = await indexerStub(env, caller.tenantId, projectId).start({ tenantId: caller.tenantId, projectId, repo: project.repo, ref: indexRef(project) });
    return json({ status: job.status }, 202);
  }
  if (action === "knowledge/search" && request.method === "GET") {
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 300) ?? "";
    if (!query) return json({ error: "Suchbegriff fehlt." }, 400);
    return json(await search(env, caller.tenantId, projectId, query, 8));
  }
  if (action === "memory" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT m.agent_id AS agentId, COALESCE((SELECT name FROM agents a WHERE a.id = m.agent_id), m.agent_id) AS agent, m.content, m.version, m.updated_at AS updatedAt
         FROM working_memory m WHERE m.tenant_id = ? AND m.project_id = ? ORDER BY m.updated_at DESC`,
    )
      .bind(caller.tenantId, projectId)
      .all();
    return json(results);
  }
  return json({ error: "Methode nicht erlaubt" }, 405);
}
