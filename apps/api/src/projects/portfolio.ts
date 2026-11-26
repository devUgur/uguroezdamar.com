import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function canWrite(caller: Caller): boolean {
  return caller.scopes.includes("portfolio:write");
}

async function list(env: Env, tenantId: string) {
  const projects = await env.DB.prepare(
    `SELECT id, name, summary, status, priority, version, created_at AS createdAt, updated_at AS updatedAt
       FROM portfolio_projects WHERE tenant_id = ? AND status != 'archived'
       ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, name`,
  ).bind(tenantId).all<Record<string, unknown>>();
  const repositories = await env.DB.prepare(
    `SELECT link.portfolio_project_id AS portfolioProjectId, repo.id, repo.name, repo.repo,
            repo.visibility, repo.default_branch AS defaultBranch, repo.write_mode AS writeMode
       FROM portfolio_project_repositories link
       JOIN projects repo ON repo.id = link.repository_project_id AND repo.tenant_id = link.tenant_id
       WHERE link.tenant_id = ? AND repo.status = 'active' ORDER BY repo.name`,
  ).bind(tenantId).all<Record<string, unknown>>();
  const byProject = new Map<string, Record<string, unknown>[]>();
  for (const repository of repositories.results) {
    const id = String(repository.portfolioProjectId);
    const group = byProject.get(id) ?? [];
    group.push({
      id: String(repository.id),
      name: String(repository.name),
      repo: repository.repo ? String(repository.repo) : null,
      visibility: String(repository.visibility),
      defaultBranch: String(repository.defaultBranch),
      writeMode: String(repository.writeMode),
    });
    byProject.set(id, group);
  }
  return projects.results.map((project) => ({ ...project, repositories: byProject.get(String(project.id)) ?? [] }));
}

/** Portfolio products group repository-access records without changing their agent permissions. */
export async function handlePortfolioProjects(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  if (path === "/api/portfolio-projects" && request.method === "GET") return json(await list(env, caller.tenantId));

  if (path === "/api/portfolio-projects" && request.method === "POST") {
    if (!canWrite(caller)) return json({ error: "Portfolio-Schreibrecht fehlt." }, 403);
    const input = await parseBody(request);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
    const priority = input?.priority ?? "P2";
    if (name.length < 2 || name.length > 100) return json({ error: "Name muss 2 bis 100 Zeichen lang sein." }, 400);
    if (summary.length > 2_000) return json({ error: "Zusammenfassung darf höchstens 2.000 Zeichen lang sein." }, 400);
    if (!["P0", "P1", "P2", "P3"].includes(String(priority))) return json({ error: "Ungültige Priorität." }, 400);
    const base = slug(name);
    if (!base) return json({ error: "Name braucht mindestens einen Buchstaben oder eine Zahl." }, 400);
    const id = `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 40);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO portfolio_projects (id, tenant_id, name, summary, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, caller.tenantId, name, summary || null, priority, caller.actor),
      env.DB.prepare("INSERT INTO portfolio_audit (id, tenant_id, portfolio_project_id, actor, action) VALUES (?, ?, ?, ?, 'project_created')")
        .bind(crypto.randomUUID(), caller.tenantId, id, caller.actor),
    ]);
    return json({ id }, 201);
  }

  const projectMatch = path.match(/^\/api\/portfolio-projects\/([a-z0-9-]{1,40})$/);
  if (projectMatch && request.method === "PATCH") {
    if (!canWrite(caller)) return json({ error: "Portfolio-Schreibrecht fehlt." }, 403);
    const input = await parseBody(request);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
    const status = input?.status;
    const priority = input?.priority;
    const version = Number(input?.version);
    if (name.length < 2 || name.length > 100) return json({ error: "Name muss 2 bis 100 Zeichen lang sein." }, 400);
    if (summary.length > 2_000) return json({ error: "Zusammenfassung darf höchstens 2.000 Zeichen lang sein." }, 400);
    if (!['active', 'paused', 'archived'].includes(String(status))) return json({ error: "Ungültiger Projektstatus." }, 400);
    if (!['P0', 'P1', 'P2', 'P3'].includes(String(priority))) return json({ error: "Ungültige Priorität." }, 400);
    if (!Number.isSafeInteger(version) || version < 1) return json({ error: "Ungültige Projektversion." }, 400);
    const result = await env.DB.batch([
      env.DB.prepare(
        `UPDATE portfolio_projects SET name = ?, summary = ?, status = ?, priority = ?, version = version + 1,
         updated_at = unixepoch() WHERE tenant_id = ? AND id = ? AND version = ?`,
      ).bind(name, summary || null, status, priority, caller.tenantId, projectMatch[1], version),
      env.DB.prepare(
        `INSERT INTO portfolio_audit (id, tenant_id, portfolio_project_id, actor, action)
         SELECT ?, ?, ?, ?, 'project_updated' WHERE changes() > 0`,
      ).bind(crypto.randomUUID(), caller.tenantId, projectMatch[1], caller.actor),
    ]);
    if (!result[0]?.meta.changes) return json({ error: "Projekt wurde gleichzeitig geändert oder entfernt. Bitte neu laden." }, 409);
    return json({ ok: true });
  }

  const match = path.match(/^\/api\/portfolio-projects\/([a-z0-9-]{1,40})\/repositories$/);
  if (match && request.method === "POST") {
    if (!canWrite(caller)) return json({ error: "Portfolio-Schreibrecht fehlt." }, 403);
    const input = await parseBody(request);
    const repositoryProjectId = typeof input?.repositoryProjectId === "string" ? input.repositoryProjectId : "";
    if (!/^[a-z0-9-]{1,40}$/.test(repositoryProjectId)) return json({ error: "Ungültiges Repository-Projekt." }, 400);
    const portfolio = await env.DB.prepare("SELECT 1 FROM portfolio_projects WHERE tenant_id = ? AND id = ? AND status != 'archived'")
      .bind(caller.tenantId, match[1]).first();
    if (!portfolio) return json({ error: "Portfolio-Projekt nicht gefunden." }, 404);
    const repository = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'")
      .bind(caller.tenantId, repositoryProjectId).first();
    if (!repository) return json({ error: "Nur aktive, registrierte Repository-Projekte können zugeordnet werden." }, 400);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO portfolio_project_repositories (tenant_id, portfolio_project_id, repository_project_id) VALUES (?, ?, ?)")
        .bind(caller.tenantId, match[1], repositoryProjectId),
      env.DB.prepare(
        `INSERT INTO portfolio_audit (id, tenant_id, portfolio_project_id, repository_project_id, actor, action)
         SELECT ?, ?, ?, ?, ?, 'repository_linked' WHERE changes() > 0`,
      ).bind(crypto.randomUUID(), caller.tenantId, match[1], repositoryProjectId, caller.actor),
    ]);
    return json({ ok: true });
  }

  return null;
}
