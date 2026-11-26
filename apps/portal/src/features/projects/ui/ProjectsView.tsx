import type { GithubRepository, Project } from "../types";
import { ProjectList } from "./ProjectList";
import { RepositoryList } from "./RepositoryList";

interface ProjectsViewProps {
  projects: Project[];
  projectsError: string | null;
  repositories: GithubRepository[];
  repositoriesError: string | null;
  notice?: string;
  error?: string;
}

/** /projects: which repositories the agents may work on, and which others exist on the GitHub account. */
export function ProjectsView({ projects, projectsError, repositories, repositoriesError, notice, error }: ProjectsViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Control Plane</p>
        <h1 className="font-serif text-3xl">Projekte</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Die Agenten können jedes Repository deines Kontos lesen. Schreiben dürfen sie nur in registrierten Projekten, auf eigenen Branches und nach deiner Freigabe. Sobald ein privates Repository im Chat vorkommt, antworten ausschließlich Modelle, die Inhalte nicht auswerten.
        </p>
      </header>

      {notice ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="projects-title">
        <h2 id="projects-title" className="font-serif text-xl">
          Registrierte Projekte
        </h2>
        {projectsError ? (
          <p role="status" className="text-sm text-destructive">
            {projectsError}
          </p>
        ) : (
          <ProjectList projects={projects} />
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="repositories-title">
        <h2 id="repositories-title" className="font-serif text-xl">
          Repositories auf GitHub
        </h2>
        <p className="text-sm text-muted-foreground">Nur Repositories deines eigenen Kontos. Organisationen sind bewusst ausgenommen.</p>
        {repositoriesError ? (
          <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
            {repositoriesError}
          </p>
        ) : (
          <RepositoryList repositories={repositories} />
        )}
      </section>
    </main>
  );
}
