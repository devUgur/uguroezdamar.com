import "server-only";

import { redirect } from "next/navigation";
import { agentsApi } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { GithubRepository, GithubStatus, KnowledgeHit, KnowledgeStatus, Project, ProjectKnowledge, ProjectOverview, ProjectPreviews, ProjectTask, Sprint, WorkingMemoryEntry } from "./types";

async function actor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/projects");
  return session.email;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

/** Registered projects. A failing API is reported to the page instead of throwing, so the rest still renders. */
export async function getProjects(): Promise<{ projects: Project[]; error: string | null }> {
  try {
    return { projects: await agentsApi<Project[]>("/api/projects", await actor()), error: null };
  } catch (error) {
    return { projects: [], error: describe(error) };
  }
}

/** Repositories on GitHub the agent token can see, limited by the API to the allowed owners. */
export async function getRepositories(): Promise<{ repositories: GithubRepository[]; error: string | null }> {
  try {
    return { repositories: await agentsApi<GithubRepository[]>("/api/github/repositories", await actor()), error: null };
  } catch (error) {
    return { repositories: [], error: describe(error) };
  }
}

/** The GitHub connection (app installations or token); an unreachable API is reported, not thrown. */
export async function getGithubStatus(): Promise<{ status: GithubStatus | null; error: string | null }> {
  try {
    const status = await agentsApi<GithubStatus>("/api/github/status", await actor());
    // An API that has not been updated yet answers in the older shape (no configuredOnly, `id` instead of `installationId`).
    const installations = (status.installations ?? []).map((entry) => ({ ...entry, installationId: entry.installationId ?? (entry as { id?: number }).id ?? 0 }));
    return { status: { ...status, installations, configuredOnly: status.configuredOnly ?? [] }, error: null };
  } catch (error) {
    return { status: null, error: describe(error) };
  }
}

const NO_PREVIEWS: ProjectPreviews = { available: false, previews: [] };

/** One project with its sprints, tasks and preview URLs. Missing project: project is null and the page shows a 404. */
export async function getProjectOverview(id: string): Promise<ProjectOverview> {
  const who = await actor();
  try {
    const [projects, sprints, tasks, previews] = await Promise.all([
      agentsApi<Project[]>("/api/projects", who),
      agentsApi<Sprint[]>(`/api/projects/${encodeURIComponent(id)}/sprints`, who).catch(() => [] as Sprint[]),
      agentsApi<ProjectTask[]>(`/api/tasks?project=${encodeURIComponent(id)}`, who),
      // An API without the previews route yet answers 404; the page then shows previews as not set up.
      agentsApi<ProjectPreviews>(`/api/projects/${encodeURIComponent(id)}/previews`, who).catch(() => NO_PREVIEWS),
    ]);
    return {
      project: projects.find((project) => project.id === id) ?? null,
      sprints,
      tasks: tasks.map((task) => ({ ...task, sprintId: task.sprintId ?? null })),
      previews,
      error: null,
    };
  } catch (error) {
    return { project: null, sprints: [], tasks: [], previews: NO_PREVIEWS, error: describe(error) };
  }
}

/** Knowledge status, the agents' working memory and, with a query, search hits for one project. */
export async function getProjectKnowledge(id: string, query: string): Promise<ProjectKnowledge> {
  const who = await actor();
  const q = query.trim().slice(0, 300);
  try {
    const [status, memory, hits] = await Promise.all([
      agentsApi<KnowledgeStatus>(`/api/projects/${encodeURIComponent(id)}/knowledge`, who),
      agentsApi<WorkingMemoryEntry[]>(`/api/projects/${encodeURIComponent(id)}/memory`, who),
      q ? agentsApi<KnowledgeHit[]>(`/api/projects/${encodeURIComponent(id)}/knowledge/search?q=${encodeURIComponent(q)}`, who) : Promise.resolve([] as KnowledgeHit[]),
    ]);
    return { status, memory, query: q, hits, error: null };
  } catch (error) {
    return { status: null, memory: [], query: q, hits: [], error: describe(error) };
  }
}
