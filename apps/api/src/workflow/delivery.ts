/**
 * The delivery workflow (plan stage 4): who works on a task in which order and what each role is asked to do.
 * Data only; the engine (engine.ts) runs it. Every step ends with a handoff the next role reads.
 */
export type DeliveryStep = "intake" | "requirements" | "plan" | "implement" | "qa" | "report";

export interface StepDefinition {
  id: DeliveryStep;
  agentId: string;
  label: string;
  /** What the role does in this step; the engine adds the task, earlier handoffs and the handoff rule. */
  instruction: string;
}

export const DELIVERY: StepDefinition[] = [
  {
    id: "intake",
    agentId: "chef",
    label: "Eingang",
    instruction:
      "Ordne den Auftrag ein: Ziel, betroffene Bereiche des Repositories, Risiken, und ob er in einen Pull Request passt. Lies dafür AGENTS.md und die relevanten Stellen. Ändere nichts.",
  },
  {
    id: "requirements",
    agentId: "product-owner",
    label: "Anforderungen",
    instruction:
      "Schärfe die Aufgabe: Ziel und Kontext, dann überprüfbare Abnahmekriterien, eine Bedingung je Zeile. Schreibe beides mit task_refine in die Aufgabe. Ist sie zu groß, lege Folgeaufgaben mit task_create an und grenze diese hier ab.",
  },
  {
    id: "plan",
    agentId: "tech-lead",
    label: "Technischer Plan",
    instruction:
      "Plane die Umsetzung: betroffene Dateien, Schnittstellen und Datenmodell, Tests, Risiken, Reihenfolge. Halte dich an die ADRs und Paketgrenzen. Du schreibst keinen Code.",
  },
  {
    id: "implement",
    agentId: "developer",
    label: "Umsetzung",
    instruction:
      "Setze den Plan um. Arbeite auf einem Branch agent/<kurzer-name>, committe die vollständigen Dateien, prüfe mit code_verify und behebe Fehler. Öffne danach einen Pull Request nach dev und nenne Branch, Commit und PR-Nummer.",
  },
  {
    id: "qa",
    agentId: "reviewer",
    label: "QA",
    instruction: "Unabhängige Prüfung gegen die Abnahmekriterien.",
  },
  {
    id: "report",
    agentId: "chef",
    label: "Bericht",
    instruction:
      "Fasse für Ugur zusammen: was umgesetzt ist, Pull Request und Preview, Ergebnis der QA, offene Punkte und was er bei der Abnahme prüfen sollte. Ändere nichts.",
  },
];

/** QA may send the work back this often; then Ugur decides. */
export const MAX_REWORK = 2;

export const HANDOFF_RULE =
  "Schließe mit einem Abschnitt „Übergabe:“ in drei bis sechs Stichpunkten für die nächste Rolle: Ergebnis, Entscheidungen, offene Punkte. Markiere die Aufgabe nicht selbst als erledigt.";

export function stepIndex(step: DeliveryStep): number {
  return DELIVERY.findIndex((definition) => definition.id === step);
}

export function stepDefinition(step: DeliveryStep): StepDefinition {
  const definition = DELIVERY.find((entry) => entry.id === step);
  if (!definition) throw new Error(`Unbekannter Ablaufschritt "${step}".`);
  return definition;
}

/** The handoff part of a step's answer, or its end when the agent wrote none. */
export function handoffOf(output: string, max = 2_000): string {
  const marker = output.search(/Übergabe:/i);
  const text = marker >= 0 ? output.slice(marker) : output;
  return text.trim().slice(-max);
}
