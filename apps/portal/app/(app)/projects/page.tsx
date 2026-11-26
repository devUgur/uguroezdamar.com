import type { Metadata } from "next";
import { getGithubStatus, getProjects, getRepositories, ProjectsView } from "@/src/features/projects";

export const metadata: Metadata = { title: "Projekte" };

type Param = string | string[] | undefined;
const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ notice?: Param; error?: Param }> }) {
  const params = await searchParams;
  const [{ projects, error: projectsError }, { repositories, error: repositoriesError }, { status, error: statusError }] = await Promise.all([
    getProjects(),
    getRepositories(),
    getGithubStatus(),
  ]);
  return (
    <ProjectsView
      projects={projects}
      projectsError={projectsError}
      repositories={repositories}
      repositoriesError={repositoriesError}
      githubStatus={status}
      githubStatusError={statusError}
      notice={first(params.notice)}
      error={first(params.error)}
    />
  );
}
