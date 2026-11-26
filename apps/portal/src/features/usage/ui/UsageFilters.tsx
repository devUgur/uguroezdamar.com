import Link from "next/link";
import { Button } from "@ugur/ui";
import type { FilterOption, UsageGroup, UsageQuery } from "../types";

interface UsageFiltersProps {
  query: UsageQuery;
  projects: FilterOption[];
  agents: FilterOption[];
  providers: UsageGroup[];
  exportHref: string;
}

const FIELD = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Plain GET form: the filter lives in the URL, so every view can be bookmarked and shared. */
export function UsageFilters({ query, projects, agents, providers, exportHref }: UsageFiltersProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4" aria-label="Filter">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Von
        <input type="date" name="from" defaultValue={query.from} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Bis
        <input type="date" name="to" defaultValue={query.to} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Projekt
        <select name="project" defaultValue={query.project ?? ""} className={FIELD}>
          <option value="">alle</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Mitarbeiter
        <select name="agent" defaultValue={query.agent ?? ""} className={FIELD}>
          <option value="">alle</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Anbieter
        <select name="provider" defaultValue={query.provider ?? ""} className={FIELD}>
          <option value="">alle</option>
          {providers.map((provider) => (
            <option key={provider.key ?? ""} value={provider.key ?? ""}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Modell
        <input name="model" defaultValue={query.model} placeholder="z. B. deepseek-flash" className={FIELD} />
      </label>
      <div className="flex gap-2">
        <Button type="submit">Anwenden</Button>
        <Button asChild variant="secondary">
          <Link href="/usage">Zurücksetzen</Link>
        </Button>
        <Button asChild variant="secondary">
          <a href={exportHref} download>
            CSV
          </a>
        </Button>
      </div>
    </form>
  );
}
