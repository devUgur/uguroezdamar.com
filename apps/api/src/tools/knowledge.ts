import type { Tool } from "./port.ts";
import { str } from "./port.ts";
import { search, WORKING_MEMORY_CHARS, writeWorkingMemory } from "../knowledge/store.ts";

/** Knowledge search and working memory (plan stage 3). Both stay within the project of the conversation. */
const knowledgeSearch: Tool = {
  spec: {
    name: "knowledge_search",
    description: "Sucht im Wissen des Projekts (Doku, ADRs, AGENTS.md, erledigte Aufgaben); liefert Abschnitte mit Quelle.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  async run(args, context) {
    const hits = await search(context.env, context.tenantId, context.projectId, str(args, "query"), 6);
    if (!hits.length) return { hits: [], note: "Nichts gefunden. Ist das Wissen des Projekts indexiert? Sonst Dateien direkt lesen." };
    return { hits: hits.map((hit) => ({ source: hit.source.replace(/^file:/, ""), heading: hit.heading, text: hit.text.slice(0, 1_200) })) };
  },
};

const memoryUpdate: Tool = {
  spec: {
    name: "memory_update",
    description: `Ersetzt dein Arbeitsgedächtnis für dieses Projekt: Ziele, Entscheidungen, offene Punkte, Konventionen. Immer das vollständige Dokument (max. ${WORKING_MEMORY_CHARS} Zeichen).`,
    parameters: { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
  },
  async run(args, context) {
    const chars = await writeWorkingMemory(context.env, context.tenantId, context.agentId, context.projectId, str(args, "content"));
    return { saved: true, chars };
  },
};

export const knowledgeTools: Tool[] = [knowledgeSearch, memoryUpdate];
