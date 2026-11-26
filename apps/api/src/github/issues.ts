import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { GithubAccessError } from "./app.ts";
import { githubToken } from "./credentials.ts";

interface GitHubIssue {
  number: number;
  html_url: string;
  state: "open" | "closed";
  updated_at: string;
}

function parseRepo(repo: string | null): { owner: string; name: string } | null {
  const match = repo?.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/);
  return match ? { owner: match[1]!, name: match[2]! } : null;
}

function issueBody(task: { description: string | null; acceptance_criteria: string | null; id: string }): string {
  return [
    task.description ?? "",
    task.acceptance_criteria ? "### Abnahmekriterien\n\n" + task.acceptance_criteria : "",
    "<!-- ugur-task:" + task.id + " -->",
  ].filter(Boolean).join("\n\n").slice(0, 60_000);
}

/** Mirrors the D1 title and description into one linked GitHub issue. */
export async function syncTaskIssue(env: Env, caller: Caller, taskId: string): Promise<{ number: number; url: string; state: string }> {
  if (!caller.scopes.includes("github:write")) throw new GithubAccessError("Nur der Owner darf Aufgaben mit GitHub synchronisieren.", 403);
  const task = await env.DB.prepare(
    "SELECT t.id, t.title, t.description, t.acceptance_criteria, t.github_issue_number, p.repo " +
    "FROM tasks t JOIN projects p ON p.id = t.project_id AND p.tenant_id = t.tenant_id " +
    "WHERE t.tenant_id = ? AND t.id = ? AND p.status = 'active'",
  ).bind(caller.tenantId, taskId).first<{
    id: string; title: string; description: string | null; acceptance_criteria: string | null;
    github_issue_number: number | null; repo: string | null;
  }>();
  if (!task) throw new GithubAccessError("Aufgabe oder aktives Repository nicht gefunden.", 404);
  const repo = parseRepo(task.repo);
  if (!repo) throw new GithubAccessError("Das Projekt hat kein gültiges GitHub-Repository.", 409);
  const token = await githubToken(env, caller.tenantId, repo.owner);
  const path = "/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.name) + "/issues";
  const init: RequestInit = {
    method: task.github_issue_number ? "PATCH" : "POST",
    body: JSON.stringify({ title: task.title, body: issueBody(task) }),
    headers: { "content-type": "application/json" },
  };
  const issue = await githubApiRequest<GitHubIssue>(task.github_issue_number ? path + "/" + task.github_issue_number : path, init, token);
  await env.DB.prepare(
    "UPDATE tasks SET github_issue_number = ?, github_issue_url = ?, github_issue_state = ?, github_issue_updated_at = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?",
  ).bind(issue.number, issue.html_url, issue.state, Math.floor(Date.parse(issue.updated_at) / 1000), caller.tenantId, taskId).run();
  await emit(env, {
    tenantId: caller.tenantId, taskId, type: "github_issue_synced",
    data: { number: issue.number, state: issue.state, by: caller.actor },
  });
  return { number: issue.number, url: issue.html_url, state: issue.state };
}

export async function githubApiRequest<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "user-agent": "uguroezdamar-api",
      "x-github-api-version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new GithubAccessError("GitHub antwortet mit " + response.status + " auf " + path.split("?")[0] + ".", response.status === 403 ? 503 : 502);
  return await response.json() as T;
}
