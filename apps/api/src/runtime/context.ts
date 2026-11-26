import type { ChatMessage } from "../models/port.ts";

/**
 * What a model sees of a thread (plan stage 2). The run in progress goes in whole and unchanged, so the provider's
 * prompt cache keeps working from step to step. Earlier runs shrink to a running summary plus the last few
 * messages, with their tool results cut short: the agent can call the tool again if it needs the full text.
 */
export const PRIOR_MESSAGES = 10;
export const PRIOR_TOOL_CHARS = 600;
/** Earlier messages beyond the kept tail before a new summary is worth a model call. */
export const SUMMARIZE_AFTER = 8;

export interface StoredMessage extends ChatMessage {
  id: number;
}

export interface ThreadSummary {
  text: string;
  /** Messages up to this id are in the summary. */
  upTo: number;
}

export function buildContext(messages: StoredMessage[], runFrom: number, summary: ThreadSummary | null, workingMemory?: string | null): ChatMessage[] {
  const prior = messages.filter((message) => message.id < runFrom);
  const current = messages.filter((message) => message.id >= runFrom).map(strip);
  const tail = prior.slice(-PRIOR_MESSAGES).map((message) => (message.role === "tool" ? { ...strip(message), content: shorten(message.content) } : strip(message)));
  // A window must not open with tool results whose call fell outside it.
  while (tail.length && tail[0]?.role === "tool") tail.shift();
  const context: ChatMessage[] = [];
  if (workingMemory?.trim()) {
    context.push({ role: "system", content: `Dein Arbeitsgedächtnis für dieses Projekt (mit memory_update aktuell halten):\n${workingMemory.trim()}` });
  }
  if (summary?.text) {
    context.push({ role: "system", content: `Zusammenfassung des bisherigen Gesprächs (ältere Nachrichten sind nicht mehr im Verlauf):\n${summary.text}` });
  }
  return [...context, ...tail, ...current];
}

/** Earlier messages that are neither in the summary nor in the kept tail, oldest first. */
export function unsummarized(messages: StoredMessage[], runFrom: number, summary: ThreadSummary | null): StoredMessage[] {
  const prior = messages.filter((message) => message.id < runFrom);
  // With few earlier messages all of them are in the tail, so nothing needs summarizing.
  const keptFrom = prior.length > PRIOR_MESSAGES ? (prior[prior.length - PRIOR_MESSAGES]?.id ?? runFrom) : (prior[0]?.id ?? runFrom);
  return prior.filter((message) => message.id > (summary?.upTo ?? 0) && message.id < keptFrom);
}

/** The request for a new summary: the old one plus the messages to fold in, tool output kept short. */
export function summaryPrompt(previous: ThreadSummary | null, messages: StoredMessage[]): ChatMessage[] {
  const transcript = messages
    .map((message) => {
      if (message.role === "tool") return `Werkzeugergebnis: ${shorten(message.content, 300)}`;
      const calls = message.toolCalls?.map((call) => `${call.name}(${call.arguments.slice(0, 200)})`).join(", ");
      return `${message.role === "user" ? "Owner" : "Agent"}: ${(message.content ?? "").slice(0, 2_000)}${calls ? ` [ruft ${calls}]` : ""}`;
    })
    .join("\n")
    .slice(-30_000);
  return [
    {
      role: "system",
      content:
        "Du fasst ein Arbeitsgespräch zwischen dem Owner und einem Software-Agenten für das spätere Weiterarbeiten zusammen. Halte fest: Ziele und Aufträge, getroffene Entscheidungen, Ergebnisse (Dateien, Commits, Pull Requests mit Nummern), offene Punkte und Zusagen. Keine Secrets, keine Spekulation. Höchstens 250 Wörter, Stichpunkte, Deutsch.",
    },
    { role: "user", content: `${previous?.text ? `Bisherige Zusammenfassung:\n${previous.text}\n\n` : ""}Neue Nachrichten:\n${transcript}` },
  ];
}

function strip(message: StoredMessage): ChatMessage {
  return { role: message.role, content: message.content, toolCalls: message.toolCalls, toolCallId: message.toolCallId, raw: message.raw };
}

function shorten(content: string | null, max = PRIOR_TOOL_CHARS): string {
  const text = content ?? "";
  return text.length > max ? `${text.slice(0, max)}… (gekürzt; bei Bedarf Werkzeug erneut aufrufen)` : text;
}
