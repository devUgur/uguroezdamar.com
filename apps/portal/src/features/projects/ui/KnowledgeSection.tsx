import { Button } from "@ugur/ui";
import { reindexKnowledge } from "../actions";
import type { ProjectKnowledge } from "../types";

const JOB_STATUS = { queued: "wartet", running: "läuft", done: "fertig", failed: "fehlgeschlagen" } as const;
const date = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toLocaleString("de-DE") : "noch nie");

/**
 * What the agents know about this project: the knowledge index (documentation, ADRs, finished tasks), a test search
 * against it, and each agent's working memory.
 */
export function KnowledgeSection({ projectId, knowledge }: { projectId: string; knowledge: ProjectKnowledge }) {
  const { status, job } = { status: knowledge.status, job: knowledge.status?.job ?? null };
  return (
    <div className="flex flex-col gap-4">
      {knowledge.error ? (
        <p role="alert" className="text-sm text-destructive">
          {knowledge.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="text-sm">
          <p>
            {status?.sources ?? 0} Quellen · {status?.chunks ?? 0} Abschnitte · {status?.embedded ?? 0} mit Vektor · zuletzt {date(status?.lastIndexedAt ?? null)}
          </p>
          {job ? (
            <p className={job.status === "failed" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              Letzter Lauf: {JOB_STATUS[job.status]}, {job.indexed} neu oder geändert, {job.skipped} unverändert
              {job.queued ? `, ${job.queued} warten` : ""}
              {job.vectorsMissing ? " · Vektoren fehlen noch (Workers AI nicht verfügbar); die Textsuche funktioniert trotzdem" : ""}
              {job.error ? ` · ${job.error}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Noch nicht indexiert.</p>
          )}
        </div>
        <form action={reindexKnowledge}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" variant="secondary">
            Wissen aktualisieren
          </Button>
        </form>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2" role="search">
        <label className="sr-only" htmlFor="knowledge-query">
          Im Wissen suchen
        </label>
        <input
          id="knowledge-query"
          name="q"
          defaultValue={knowledge.query}
          placeholder="Im Wissen suchen, z. B. Datenrichtlinie"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit">Suchen</Button>
      </form>
      {knowledge.query ? (
        knowledge.hits.length ? (
          <ol className="flex flex-col gap-2">
            {knowledge.hits.map((hit) => (
              <li key={hit.chunkId} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {hit.source.replace(/^file:/, "")} · {hit.via.map((via) => (via === "text" ? "Text" : "Bedeutung")).join(" + ")}
                </span>
                {hit.heading ? <span className="font-medium">{hit.heading}</span> : null}
                <span className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{hit.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Treffer für „{knowledge.query}“.</p>
        )
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Arbeitsgedächtnis der Mitarbeiter</h3>
        {knowledge.memory.length ? (
          knowledge.memory.map((entry) => (
            <details key={entry.agentId} className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer">
                {entry.agent} <span className="text-xs text-muted-foreground">· Version {entry.version} · {date(entry.updatedAt)}</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{entry.content}</p>
            </details>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein Mitarbeiter hat für dieses Projekt etwas festgehalten.</p>
        )}
      </div>
    </div>
  );
}
