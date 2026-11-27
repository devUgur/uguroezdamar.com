import type { OfficeInitiative, OfficeScope } from "../../types";

interface InitiativesWidgetProps {
  scope: OfficeScope;
  initiatives: OfficeInitiative[];
  onOpen: (initiativeId: string | null) => void;
}

/** Labels of the planning steps (apps/api/src/workflow/planning.ts). */
export const PLANNING_STEPS = [
  { step: "intake", label: "Eingang" },
  { step: "discovery", label: "Anforderungen" },
  { step: "architecture", label: "Architektur" },
  { step: "review", label: "Konzeptprüfung" },
  { step: "backlog", label: "Backlog" },
  { step: "sprint", label: "Sprintplanung" },
  { step: "summary", label: "Zusammenfassung" },
];

/** Where a planning stands, in Ugur's words. */
export function phaseOf(initiative: OfficeInitiative): { text: string; needsOwner: boolean } {
  const planning = initiative.planning;
  if (!planning) return { text: "geplant", needsOwner: false };
  const openQuestions = initiative.questions.filter((question) => !question.answer).length;
  if (planning.status === "waiting_owner") return { text: openQuestions ? `${openQuestions} Rückfrage(n) an dich` : "wartet auf dich", needsOwner: true };
  if (planning.status === "awaiting_acceptance") return { text: "Planung zur Freigabe", needsOwner: true };
  if (planning.status === "done") return { text: "freigegeben, Sprint läuft", needsOwner: false };
  if (planning.status === "cancelled") return { text: "abgebrochen", needsOwner: false };
  return { text: `Team plant: ${PLANNING_STEPS.find((step) => step.step === planning.step)?.label ?? planning.step}`, needsOwner: false };
}

/** The wishes Ugur gave the team (ADR 0041): where each planning stands, and the way to a new one. */
export function InitiativesWidget({ scope, initiatives, onOpen }: InitiativesWidgetProps) {
  const visible = initiatives.filter((initiative) => scope === null || initiative.projectId === scope).slice(0, 6);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Vorhaben</h2>
        <button type="button" onClick={() => onOpen(null)} className="text-xs underline underline-offset-4 hover:text-foreground">
          Neues Vorhaben
        </button>
      </header>
      {visible.length ? (
        <ul className="flex flex-col gap-1.5">
          {visible.map((initiative) => {
            const phase = phaseOf(initiative);
            return (
              <li key={initiative.id}>
                <button type="button" onClick={() => onOpen(initiative.id)} className="flex w-full flex-col rounded px-1 py-1 text-left hover:bg-accent">
                  <span className="truncate text-sm">{initiative.title}</span>
                  <span className={phase.needsOwner ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{phase.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Beschreibe, was entstehen soll. Das Team stellt Rückfragen, plant Architektur und Backlog und schlägt einen Sprint vor.</p>
      )}
    </section>
  );
}
