import type { ProjectPreviews } from "../types";

const time = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

/** Preview URLs of a project's branches and pull requests (ADR 0035). Agents propose them; the owner approves each one. */
export function PreviewSection({ previews }: { previews: ProjectPreviews }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="previews-title">
      <h2 id="previews-title" className="font-serif text-xl">
        Previews
      </h2>
      {previews.previews.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {previews.previews.map((preview) => (
            <li key={preview.alias} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{preview.ref}</span>
                {preview.commit ? <span className="ml-2 font-mono text-xs text-muted-foreground">{preview.commit.slice(0, 7)}</span> : null}
              </div>
              {preview.status === "ready" ? (
                <a href={preview.url} target="_blank" rel="noreferrer" className="break-all font-mono text-xs underline-offset-2 hover:underline">
                  {preview.url}
                </a>
              ) : (
                <span className="text-xs text-destructive">Upload fehlgeschlagen</span>
              )}
              <span className="text-xs text-muted-foreground">{time.format(new Date(preview.updatedAt * 1000))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {previews.available
            ? "Noch keine Preview. Der Chef-Agent schlägt sie für einen Branch oder Pull Request vor (preview_deploy); du gibst sie frei."
            : "Previews sind noch nicht eingerichtet: Workstations und Preview-Token der Agenten-API fehlen (ADR 0035)."}
        </p>
      )}
    </section>
  );
}
