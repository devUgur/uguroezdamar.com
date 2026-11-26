import "server-only";

import { redirect } from "next/navigation";
import { agentsApi } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import { currentOrganizationAccess } from "@/src/server/organization-access";
import type { PortfolioProject, RepositoryProject } from "./types";

async function actor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/portfolio");
  return session.email;
}

export async function getPortfolio(): Promise<{ projects: PortfolioProject[]; repositories: RepositoryProject[]; canManage: boolean; error: string | null }> {
  try {
    const who = await actor();
    const [projects, repositories, access] = await Promise.all([
      agentsApi<PortfolioProject[]>("/api/portfolio-projects", who),
      agentsApi<RepositoryProject[]>("/api/projects", who),
      currentOrganizationAccess(),
    ]);
    return { projects, repositories: repositories.filter((repository) => repository.status === "active"), canManage: access.canManage, error: null };
  } catch (error) {
    return { projects: [], repositories: [], canManage: false, error: error instanceof Error ? error.message : "Portfolio konnte nicht geladen werden." };
  }
}
