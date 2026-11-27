"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@ugur/ui";
import { setProjectAutonomy } from "../../actions";
import type { AutonomyLevel, OfficeScope, PolicyCatalog, ThreadProject } from "../../types";

interface AutonomyWidgetProps {
  scope: OfficeScope;
  projects: ThreadProject[];
  policies: PolicyCatalog | null;
  canManage: boolean;
  /** Reloads the board data after a change. */
  onChanged: () => void;
}

export const LEVEL_LABEL: Record<AutonomyLevel, string> = { manual: "Manuell", balanced: "Ausgewogen", high: "Hoch", max: "Maximal" };
const LEVEL_HINT: Record<AutonomyLevel, string> = {
  manual: "Jede schreibende Aktion wartet auf dich.",
  balanced: "Routine läuft allein, Pull Requests und dev mit Freigabe.",
  high: "Auch Pull Requests nach dev laufen allein.",
  max: "Alles innerhalb der globalen Grenzen läuft allein.",
};

/**
 * How independently the agents work (ADR 0040, P2): per project a level, with what it lets run on its own. The
 * global limits (CI/CD, releases, new repositories) always stay with Ugur and are listed as such.
 */
export function AutonomyWidget({ scope, projects, policies, canManage, onChanged }: AutonomyWidgetProps) {
  const [pending, startTransition] = useTransition();
  if (!policies) return null;

  if (!scope) {
    const counts = policies.levels.map((level) => ({ level, count: policies.projects.filter((project) => project.level === level).length })).filter((entry) => entry.count);
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Autonomie</h2>
        <p className="text-xs text-muted-foreground">{counts.map((entry) => `${LEVEL_LABEL[entry.level]} ${entry.count}`).join(" · ") || "Keine Projekte"}</p>
        <p className="text-xs text-muted-foreground">Je Projekt einstellbar: oben ein Projekt wählen.</p>
      </section>
    );
  }

  const current = policies.projects.find((project) => project.projectId === scope);
  const level = current?.level ?? policies.defaultLevel;
  const automatic = policies.classes.filter((rule) => rule.id !== "read" && rule.id !== "work" && rule.levels[level] === "allow");
  const hard = policies.classes.filter((rule) => rule.hard);

  function change(next: string) {
    if (!current) return;
    startTransition(async () => {
      const result = await setProjectAutonomy(scope as string, next as AutonomyLevel, current.version);
      if (!result.ok) toast.error(result.error ?? "Autonomie konnte nicht gespeichert werden.");
      else {
        toast.success(`Autonomie: ${LEVEL_LABEL[next as AutonomyLevel]}.`);
        onChanged();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Autonomie</h2>
        <span className="text-xs text-muted-foreground">{projects.find((project) => project.id === scope)?.name}</span>
      </header>
      <Select value={level} onValueChange={change} disabled={!canManage || pending || !current}>
        <SelectTrigger className="h-9" aria-label="Autonomie des Projekts">
          <SelectValue>{LEVEL_LABEL[level]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {policies.levels.map((option) => (
            <SelectItem key={option} value={option}>
              {LEVEL_LABEL[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{LEVEL_HINT[level]}</p>
      <div className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Läuft allein</span>
        <span>{automatic.length ? automatic.map((rule) => rule.label).join(", ") : "nur Lesen, Prüfen und Aufgaben anlegen"}</span>
        <span className="pt-1 text-muted-foreground">Immer mit deiner Freigabe</span>
        <span>{hard.map((rule) => rule.label).join(", ")}</span>
      </div>
      {canManage ? null : <p className="text-xs text-muted-foreground">Nur der Owner kann die Stufe ändern.</p>}
    </section>
  );
}
