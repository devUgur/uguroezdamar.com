import type { Env } from "../env.ts";

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

async function github<T>(env: Env, path: string): Promise<T> {
  const token = env.AGENT_GITHUB_TOKEN;
  if (!token) throw new ProjectError("AGENT_GITHUB_TOKEN ist nicht gesetzt.", 503);
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "uguroezdamar-api",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (response.status === 401) throw new ProjectError("GitHub lehnt den Token ab (abgelaufen oder ungültig).", 502);
  if (response.status === 404) throw new ProjectError("Repository nicht gefunden oder für den Token nicht freigegeben.", 404);
  if (!response.ok) throw new ProjectError(`GitHub antwortet mit ${response.status}.`, 502);
  return (await response.json()) as T;
}

/** GitHub accounts whose repositories may become projects (comma-separated Worker variable). */
export function allowedOwners(env: Env): string[] {
  return (env.GITHUB_OWNERS ?? "")
    .split(",")
    .map((owner) => owner.trim().toLowerCase())
    .filter(Boolean);
}

function ownerAllowed(env: Env, owner: string): boolean {
  return allowedOwners(env).includes(owner.toLowerCase());
}

/** Repositories the token can see, restricted to the allowed owners, with the project each one is registered as. */
export async function listRepositories(env: Env) {
  const repos: GithubRepo[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const batch = await github<GithubRepo[]>(env, `/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const { results } = await env.DB.prepare("SELECT id, repo FROM projects WHERE repo IS NOT NULL AND status = 'active'").all<{ id: string; repo: string }>();
  const registered = new Map(results.map((row) => [row.repo.toLowerCase(), row.id]));
  return repos
    .filter((repo) => ownerAllowed(env, repo.owner.login))
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
export async function registerProject(env: Env, fullName: string): Promise<{ id: string; created: boolean }> {
  if (!REPO_NAME.test(fullName)) throw new ProjectError("Repository im Format owner/name angeben.", 400);
  const owner = fullName.split("/")[0] ?? "";
  if (!ownerAllowed(env, owner)) throw new ProjectError(`Der Besitzer „${owner}“ ist nicht freigegeben.`, 403);

  const repo = await github<GithubRepo>(env, `/repos/${fullName}`);
  if (repo.archived) throw new ProjectError("Das Repository ist archiviert; dort kann nicht geschrieben werden.", 409);

  const visibility = repo.private ? "private" : "public";
  const existing = await env.DB.prepare("SELECT id FROM projects WHERE lower(repo) = lower(?)").bind(repo.full_name).first<{ id: string }>();
  if (existing) {
    await env.DB.prepare("UPDATE projects SET status = 'active', visibility = ?, default_branch = ? WHERE id = ?")
      .bind(visibility, repo.default_branch, existing.id)
      .run();
    return { id: existing.id, created: false };
  }

  const base = slug(repo.name);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const id = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await env.DB.prepare("SELECT 1 FROM projects WHERE id = ?").bind(id).first();
    if (taken) continue;
    await env.DB.prepare("INSERT INTO projects (id, name, repo, status, visibility, default_branch, write_mode) VALUES (?, ?, ?, 'active', ?, ?, 'pr-only')")
      .bind(id, repo.name, repo.full_name, visibility, repo.default_branch)
      .run();
    return { id, created: true };
  }
  throw new ProjectError("Kein freier Projektname gefunden.", 409);
}

/** Takes a project out of use. Rows stay for the history of threads and tasks; this repository's project cannot be removed. */
export async function unregisterProject(env: Env, id: string): Promise<boolean> {
  if (id === "uguroezdamar") throw new ProjectError("Das Hauptprojekt lässt sich nicht entfernen.", 409);
  const result = await env.DB.prepare("UPDATE projects SET status = 'archived' WHERE id = ? AND status = 'active'").bind(id).run();
  return Boolean(result.meta.changes);
}
