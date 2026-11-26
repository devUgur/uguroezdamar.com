import "server-only";

import { redirect } from "next/navigation";
import { agentsApi } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { GithubRepository, GithubStatus, Project } from "./types";

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
    return { status: await agentsApi<GithubStatus>("/api/github/status", await actor()), error: null };
  } catch (error) {
    return { status: null, error: describe(error) };
  }
}
