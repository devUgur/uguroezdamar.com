import type { StepDefinition } from "./delivery.ts";

/**
 * The planning workflow (ADR 0041): from a wish in Ugur's words to a reviewed concept, a structured backlog and a
 * proposed sprint. Data only; the engine runs it. Each step's full answer is kept as an artifact the next roles read.
 */
export const PLANNING: StepDefinition[] = [
  {
    id: "intake",
    agentId: "chef",
    label: "Eingang",
    instruction:
      "Verstehe den Wunsch im Zusammenhang des Projekts (AGENTS.md, Wissen, bestehende ADRs). Fasse Ziel, Umfang, Annahmen und Erfolgsmaß zusammen. Fehlt etwas, ohne das keine sinnvolle Planung möglich ist, frage mit ask_owner (höchstens fünf Fragen, je mit Begründung und deinem Vorschlag).",
  },
  {
    id: "discovery",
    agentId: "product-owner",
    label: "Anforderungen",
    instruction:
      "Schreibe die Anforderungen: Ziele, Nicht-Ziele, Nutzer und Rollen, wichtigste Abläufe Schritt für Schritt, fachliche Regeln, Annahmen, Risiken, offene Punkte. Frage mit ask_owner nur, was du nicht begründet annehmen kannst.",
  },
  {
    id: "architecture",
    agentId: "tech-lead",
    label: "Architektur",
    instruction:
      "Entwirf die Architektur passend zum bestehenden Repository: Komponenten und ihre Grenzen, Datenmodell, Schnittstellen, Technikentscheidungen mit Alternativen und Begründung (als ADR-Kandidaten), Sicherheit, Teststrategie, Migrationen, Risiken. Halte dich an AGENTS.md und die gültigen ADRs.",
  },
  {
    id: "review",
    agentId: "reviewer",
    label: "Konzeptprüfung",
    instruction:
      "Prüfe Anforderungen und Architektur unabhängig: Lücken, Widersprüche, Sicherheit, Datenschutz, Testbarkeit, Aufwand. Urteil pass, wenn umsetzbar; changes_requested mit konkreten Befunden, wenn die Architektur nachgebessert werden muss; needs_human, wenn Ugur entscheiden muss.",
  },
  {
    id: "backlog",
    agentId: "scrum-master",
    label: "Backlog",
    instruction:
      "Lege mit task_create das Backlog an: zuerst Epics (kind epic), darunter Stories oder technische Tasks (parentId = Epic). Jedes Ticket bekommt Ziel und Kontext, Umfang und Nicht-Umfang, betroffene Bereiche, Abnahmekriterien (eine Bedingung je Zeile), Testanforderung, Story Points, die passende Rolle und seine Abhängigkeiten (dependsOn). Jedes Ticket passt in einen Pull Request; zu große zerlegst du, zu kleine fasst du zusammen. Prüfe am Ende mit tasks_list, dass nichts fehlt.",
  },
  {
    id: "sprint",
    agentId: "scrum-master",
    label: "Sprintplanung",
    instruction:
      "Schlage mit sprint_propose den ersten Sprint vor: ein klares Sprintziel und die Tickets, die zusammen einen nutzbaren Zwischenstand ergeben, in der Reihenfolge ihrer Abhängigkeiten. Nimm nur Tickets mit Abnahmekriterien, deren Abhängigkeiten im selben Sprint oder schon erledigt sind.",
  },
  {
    id: "summary",
    agentId: "chef",
    label: "Zusammenfassung",
    instruction:
      "Fasse für Ugur das Gesamtkonzept verständlich zusammen: Ziel, Architektur in wenigen Sätzen, Epics und Umfang, vorgeschlagener erster Sprint, Risiken und die Entscheidungen, die er treffen sollte. Er gibt danach die Planung frei oder verlangt Änderungen.",
  },
];

export const PLANNING_RULE =
  "Arbeite gründlich, aber ohne Fülltext. Schreibe dein Ergebnis vollständig in deine Antwort (es wird als Artefakt gespeichert) und schließe mit „Übergabe:“ in drei bis sechs Stichpunkten. Ändere keinen Code.";

/** The planning review may send the architecture back this often. */
export const MAX_CONCEPT_REWORK = 1;

/** The reviewer answers with JSON ({"verdict": …}); anything else counts as needing Ugur. */
export function conceptVerdict(output: string): { verdict: "pass" | "changes_requested" | "needs_human"; summary: string } {
  const match = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match?.[0] ?? "") as { verdict?: string; summary?: string; findings?: string[] };
    const verdict = parsed.verdict === "pass" || parsed.verdict === "changes_requested" ? parsed.verdict : "needs_human";
    return { verdict, summary: [parsed.summary, ...(parsed.findings ?? [])].filter(Boolean).join("\n") };
  } catch {
    return { verdict: "needs_human", summary: "Die Konzeptprüfung hat kein lesbares Urteil geliefert." };
  }
}
