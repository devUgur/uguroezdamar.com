import Link from "next/link";
import { Button } from "@ugur/ui";
import { createPortfolioProject, linkPortfolioRepository, updatePortfolioProject } from "../actions";
import type { PortfolioProject, RepositoryProject } from "../types";

interface PortfolioViewProps {
  projects: PortfolioProject[];
  repositories: RepositoryProject[];
  canManage: boolean;
  error: string | null;
  notice?: string;
  actionError?: string;
}

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

/** Product/project portfolio; linked repository records retain their own access policy. */
export function PortfolioView({ projects, repositories, canManage, error, notice, actionError }: PortfolioViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Control Plane</p>
        <h1 className="font-serif text-3xl">Portfolio</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Produkte und Aufträge bündeln ihre Repository-Projekte. Die Zuordnung ändert keine GitHub- oder Agentenrechte.
        </p>
      </header>

      {notice ? <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">{notice}</p> : null}
      {actionError ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{actionError}</p> : null}

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <h2 className="font-serif text-xl">Produktprojekte</h2>
          {error ? <p role="status" className="text-sm text-destructive">{error}</p> : projects.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium">{project.name}</h3>
                      {project.summary ? <p className="mt-1 text-sm text-muted-foreground">{project.summary}</p> : null}
                    </div>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-xs">{project.priority}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    {project.repositories.length ? project.repositories.map((repository) => (
                      <Link key={repository.id} href={`/projects/${repository.id}`} className="text-muted-foreground underline-offset-2 hover:underline">
                        {repository.repo ?? repository.name}
                      </Link>
                    )) : <span className="text-muted-foreground">Noch keine Repositories zugeordnet.</span>}
                  </div>
                  {canManage ? <details className="border-t border-border pt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">Projekt bearbeiten</summary>
                    <form action={updatePortfolioProject} className="mt-3 flex flex-col gap-3">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="version" value={project.version} />
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Name
                        <input name="name" required minLength={2} maxLength={100} defaultValue={project.name} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Ziel oder Kurzbeschreibung
                        <textarea name="summary" rows={3} maxLength={2000} defaultValue={project.summary ?? ""} className="rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Priorität
                          <select name="priority" defaultValue={project.priority} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                            {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Status
                          <select name="status" defaultValue={project.status} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                            <option value="active">Aktiv</option><option value="paused">Pausiert</option><option value="archived">Archiviert</option>
                          </select>
                        </label>
                      </div>
                      <Button type="submit" variant="secondary">Speichern</Button>
                    </form>
                  </details> : null}
                  {canManage && repositories.some((repository) => !project.repositories.some((linked) => linked.id === repository.id)) ? (
                    <form action={linkPortfolioRepository} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                      <input type="hidden" name="projectId" value={project.id} />
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                        Repository zuordnen
                        <select name="repositoryProjectId" required className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                          {repositories.filter((repository) => !project.repositories.some((linked) => linked.id === repository.id)).map((repository) => (
                            <option key={repository.id} value={repository.id}>{repository.repo ?? repository.name}</option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" variant="secondary">Zuordnen</Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Noch keine Produktprojekte angelegt.</p>}
        </div>

        {canManage ? <form action={createPortfolioProject} className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <h2 className="font-serif text-xl">Projekt anlegen</h2>
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" required minLength={2} maxLength={100} className="h-10 rounded-md border border-input bg-background px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ziel oder Kurzbeschreibung
            <textarea name="summary" rows={4} maxLength={2000} className="rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Priorität
            <select name="priority" defaultValue="P2" className="h-10 rounded-md border border-input bg-background px-3">
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </label>
          <Button type="submit">Zum Portfolio hinzufügen</Button>
        </form> : null}
      </section>
    </main>
  );
}
