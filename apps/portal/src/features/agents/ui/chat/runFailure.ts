import type { AgentEvent } from "../../types";

export interface RunFailure {
  /** What went wrong, in words Ugur can act on. */
  title: string;
  /** The raw message of the API, for details. */
  detail: string;
}

const ENDED = new Set(["error", "budget_blocked"]);

/**
 * The failure of the latest run, if it ended in one. A failed run stores no assistant message, so
 * without this the chat shows the question and nothing below it.
 */
export function latestRunFailure(events: AgentEvent[]): RunFailure | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) continue;
    if (event.type === "user_message" || event.type === "message" || event.type === "stopped") return null;
    if (ENDED.has(event.type)) return describe(event);
  }
  return null;
}

function describe(event: AgentEvent): RunFailure {
  const raw = event.data?.message;
  const detail = typeof raw === "string" ? raw : JSON.stringify(event.data ?? {});
  if (event.type === "budget_blocked") return { title: "Das Tagesbudget dieses Agenten ist aufgebraucht.", detail };
  const blocked = [...detail.matchAll(/([\w.-]+)\/[^:|]+: gesperrt \(privates Repository/g)].map((match) => match[1]);
  if (blocked.length && !/: ok\b/.test(detail)) {
    return {
      title: `Dieses Repository ist privat. ${[...new Set(blocked)].join(", ")} darf Eingaben auswerten und ist dafür gesperrt; ein Modell ohne Datenauswertung (z. B. Claude oder OpenAI) hat keinen Schlüssel oder ist ausgefallen.`,
      detail,
    };
  }
  if (/4006|daily free allocation|neurons/i.test(detail)) {
    return {
      title: "Workers AI hat das kostenlose Tageskontingent aufgebraucht, und kein anderes Modell ist eingerichtet.",
      detail,
    };
  }
  if (/no credentials/i.test(detail) && !/: ok\b/.test(detail)) {
    return { title: "Für kein Modell dieser Rolle ist ein Schlüssel hinterlegt.", detail };
  }
  if (/privat/i.test(detail)) return { title: "Für dieses private Projekt ist kein Modell ohne Datenauswertung verfügbar.", detail };
  return { title: "Der Lauf ist mit einem Fehler abgebrochen.", detail };
}
