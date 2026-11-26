import { Button } from "@ugur/ui";
import { registerProject } from "../actions";
import type { GithubRepository } from "../types";

/** Everything the agent token can see. Seeing a repository does not give the agents access; registering it does. */
export function RepositoryList({ repositories }: { repositories: GithubRepository[] }) {
  if (!repositories.length) return <p className="text-sm text-muted-foreground">Keine Repositories gefunden.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
      {repositories.map((repo) => (
        <li key={repo.fullName} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{repo.name}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{repo.private ? "privat" : "öffentlich"}</span>
              {repo.fork ? <span className="text-xs text-muted-foreground">Fork</span> : null}
              {repo.archived ? <span className="text-xs text-destructive">archiviert</span> : null}
            </p>
            {repo.description ? <p className="truncate text-xs text-muted-foreground">{repo.description}</p> : null}
          </div>
          {repo.projectId ? (
            <span className="text-xs text-muted-foreground">ist Projekt</span>
          ) : repo.archived ? (
            <span className="text-xs text-muted-foreground">nicht möglich</span>
          ) : (
            <form action={registerProject}>
              <input type="hidden" name="repo" value={repo.fullName} />
              <Button type="submit" variant="secondary">
                Als Projekt hinzufügen
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
