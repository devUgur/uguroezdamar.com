import type { Env } from "../env.ts";
import { appConfigured, GithubAccessError, installations } from "../github/app.ts";
import { githubToken, personalToken } from "../github/credentials.ts";
import { allowedOwnersFor } from "../github/tenants.ts";
import { OWNER_TENANT } from "../tenancy.ts";

const API = "https://api.github.com";
const REPO_NAME = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;

export class ProjectError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface GithubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  archived: boolean;
  fork: boolean;
  description: string | null;
  pushed_at: string | null;
}

interface Call {
  /** The tenant the call is for: only the owner may use the personal token. */
  tenantId: string;
  /** Account whose repositories the call touches; selects the GitHub App installation. */
  owner?: string;
  /** User-level endpoint: only the personal token can call it, an app installation cannot. */
  personal?: boolean;
  /** Runs before every GitHub request, to count it against a subrequest budget. */
  beforeFetch?: () => void;
  /** JSON body of a POST. */
  post?: unknown;
}

async function github<T>(env: Env, path: string, call: Call): Promise<T> {
  let token: string;
  try {
    token = call.personal || !call.owner ? personalToken(env, call.tenantId) : await githubToken(env, call.tenantId, call.owner, call.beforeFetch);
  } catch (error) {
    if (error instanceof GithubAccessError) throw new ProjectError(error.message, error.status);
    throw error;
  }
  call.beforeFetch?.();
  const write = call.post !== undefined;
  const response = await fetch(`${API}${path}`, {
    method: write ? "POST" : "GET",
    body: write ? JSON.stringify(call.post) : undefined,
    headers: {
      ...(write ? { "content-type": "application/json" } : {}),
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "uguroezdamar-api",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (response.status === 401) throw new ProjectError("GitHub lehnt den Zugang ab (Token abgelaufen oder ungültig).", 502);
  if (write && (response.status === 403 || response.status === 404)) {
    throw new ProjectError("GitHub erlaubt dem Token diese Aktion nicht (zum Anlegen braucht er Administration: Read and write).", 403);
  }
  if (write && response.status === 422) throw new ProjectError("GitHub lehnt den Namen ab (oft: gibt es schon).", 409);
  if (response.status === 404) throw new ProjectError("Repository nicht gefunden oder für den Zugang nicht freigegeben.", 404);
  if (!response.ok) throw new ProjectError(`GitHub antwortet mit ${response.status}.`, 502);
  return (await response.json()) as T;
}

async function ownerAllowed(env: Env, tenantId: string, owner: string): Promise<boolean> {
  return (await allowedOwnersFor(env, tenantId)).includes(owner.toLowerCase());
}

/**
 * Repositories GitHub shows to the app installations and to the personal token, restricted to the allowed
 * owners, with the project each one is registered as. `beforeFetch` runs before every GitHub call, so callers
 * inside an agent run can count it against their subrequest budget.
 */
export async function listRepositories(env: Env, tenantId: string, beforeFetch?: () => void) {
  const allowed = await allowedOwnersFor(env, tenantId);
  const found = new Map<string, GithubRepo>();
  const add = (batch: GithubRepo[]) => batch.forEach((repo) => found.has(repo.full_name.toLowerCase()) || found.set(repo.full_name.toLowerCase(), repo));
  if (!appConfigured(env) && !(tenantId === OWNER_TENANT && env.AGENT_GITHUB_TOKEN)) personalToken(env, tenantId);
  try {
    if (appConfigured(env)) {
      for (const installation of await installations(env, beforeFetch)) {
        if (!allowed.includes(installation.account.toLowerCase())) continue;
        for (let page = 1; page <= 4; page += 1) {
          const batch = await github<{ repositories: GithubRepo[] }>(env, `/installation/repositories?per_page=100&page=${page}`, {
            tenantId,
            owner: installation.account,
            beforeFetch,
          });
          add(batch.repositories);
          if (batch.repositories.length < 100) break;
        }
      }
    }
  } catch (error) {
    if (error instanceof GithubAccessError) throw new ProjectError(error.message, error.status);
    throw error;
  }
  if (tenantId === OWNER_TENANT && env.AGENT_GITHUB_TOKEN) {
    for (let page = 1; page <= 4; page += 1) {
      const batch = await github<GithubRepo[]>(env, `/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`, { tenantId, personal: true, beforeFetch });
      add(batch);
      if (batch.length < 100) break;
    }
  }
  const repos = [...found.values()];
  const { results } = await env.DB.prepare("SELECT id, repo FROM projects WHERE tenant_id = ? AND repo IS NOT NULL AND status = 'active'")
    .bind(tenantId)
    .all<{ id: string; repo: string }>();
  const registered = new Map(results.map((row) => [row.repo.toLowerCase(), row.id]));
  return repos
    .filter((repo) => allowed.includes(repo.owner.login.toLowerCase()))
    .map((repo) => ({
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch,
      archived: repo.archived,
      fork: repo.fork,
      description: repo.description,
      pushedAt: repo.pushed_at,
      projectId: registered.get(repo.full_name.toLowerCase()) ?? null,
    }));
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "project";
}

/** Makes a repository a project. Checks owner, access and archive state against GitHub, never trusting the client. */
export async function registerProject(env: Env, tenantId: string, fullName: string): Promise<{ id: string; created: boolean }> {
  if (!REPO_NAME.test(fullName)) throw new ProjectError("Repository im Format owner/name angeben.", 400);
  const owner = fullName.split("/")[0] ?? "";
  if (!(await ownerAllowed(env, tenantId, owner))) throw new ProjectError(`Der Besitzer „${owner}“ ist nicht freigegeben.`, 403);

  const repo = await github<GithubRepo>(env, `/repos/${fullName}`, { tenantId, owner });
  if (repo.archived) throw new ProjectError("Das Repository ist archiviert; dort kann nicht geschrieben werden.", 409);

  const visibility = repo.private ? "private" : "public";
  const existing = await env.DB.prepare("SELECT id FROM projects WHERE tenant_id = ? AND lower(repo) = lower(?)")
    .bind(tenantId, repo.full_name)
    .first<{ id: string }>();
  if (existing) {
    await env.DB.prepare("/* tenant:parent */ UPDATE projects SET status = 'active', visibility = ?, default_branch = ? WHERE id = ?")
      .bind(visibility, repo.default_branch, existing.id)
      .run();
    return { id: existing.id, created: false };
  }

  const base = slug(repo.name);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const id = attempt === 0 ? base : `${base}-${attempt + 1}`;
    // Project ids are unique across all tenants (they are the primary key), so this lookup is deliberately not scoped.
    const taken = await env.DB.prepare("/* tenant:platform */ SELECT 1 FROM projects WHERE id = ?").bind(id).first();
    if (taken) continue;
    await env.DB.prepare("INSERT INTO projects (id, tenant_id, name, repo, status, visibility, default_branch, write_mode) VALUES (?, ?, ?, ?, 'active', ?, ?, 'pr-only')")
      .bind(id, tenantId, repo.name, repo.full_name, visibility, repo.default_branch)
      .run();
    return { id, created: true };
  }
  throw new ProjectError("Kein freier Projektname gefunden.", 409);
}

const NEW_REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * Creates a repository on the token's own account (never an organization) and registers it as a project.
 * Private unless asked otherwise; the first commit (README) gives it a default branch.
 */
export async function createRepository(
  env: Env,
  tenantId: string,
  input: { name: string; description?: string; private?: boolean },
): Promise<{ fullName: string; private: boolean; projectId: string }> {
  if (!NEW_REPO_NAME.test(input.name) || input.name.endsWith(".git")) {
    throw new ProjectError("Ungültiger Repository-Name (Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich).", 400);
  }
  if (tenantId !== OWNER_TENANT) throw new ProjectError("Repositories lassen sich nur auf dem Konto des Owners anlegen.", 403);
  const me = await github<{ login: string }>(env, "/user", { tenantId, personal: true });
  if (!(await ownerAllowed(env, tenantId, me.login))) throw new ProjectError(`Das Konto „${me.login}“ ist nicht freigegeben.`, 403);
  const created = await github<GithubRepo>(env, "/user/repos", {
    tenantId,
    personal: true,
    post: { name: input.name, description: input.description?.slice(0, 300), private: input.private !== false, auto_init: true },
  });
  const { id } = await registerProject(env, tenantId, created.full_name);
  return { fullName: created.full_name, private: created.private, projectId: id };
}

/** Takes a project out of use. Rows stay for the history of threads and tasks; this repository's project cannot be removed. */
export async function unregisterProject(env: Env, tenantId: string, id: string): Promise<boolean> {
  if (tenantId === OWNER_TENANT && id === "uguroezdamar") throw new ProjectError("Das Hauptprojekt lässt sich nicht entfernen.", 409);
  const result = await env.DB.prepare("UPDATE projects SET status = 'archived' WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(tenantId, id).run();
  return Boolean(result.meta.changes);
}
