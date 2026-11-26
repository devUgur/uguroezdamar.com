import { describe, expect, it } from "vitest";
import type { Env } from "../apps/api/src/env.ts";
import { chunkMarkdown, isKnowledgeFile, MAX_CHARS } from "../apps/api/src/knowledge/chunk.ts";
import { ftsQuery, knowledgeStatus, readWorkingMemory, removeSource, replaceSource, search } from "../apps/api/src/knowledge/store.ts";
import { buildContext } from "../apps/api/src/runtime/context.ts";
import { toolsByName } from "../apps/api/src/tools/registry.ts";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import { sqliteD1 } from "./_helpers/sqlite-d1.ts";

const ADR = `# ADR 0033: Modellanbieter

## Kontext
Die Agenten hatten nur kostenlose Modelle. Private Repositories durften nur an Anbieter ohne Datenauswertung gehen.

## Entscheidung
### Datenrichtlinie je Projekt
Der Owner setzt je Projekt streng oder offen. DeepSeek darf Eingaben auswerten und ist deshalb nur in offenen Projekten erlaubt.

\`\`\`ts
# kein Titel im Codeblock
const x = 1;
\`\`\`
`;

/** Fake Vectorize: stores vectors in memory and ranks by dot product, honouring the metadata filter. */
function fakeVectorize() {
  const store = new Map<string, { values: number[]; metadata: Record<string, string> }>();
  return {
    store,
    async upsert(vectors: { id: string; values: number[]; metadata: Record<string, string> }[]) {
      for (const vector of vectors) store.set(vector.id, { values: vector.values, metadata: vector.metadata });
      return { mutationId: "m" };
    },
    async deleteByIds(ids: string[]) {
      for (const id of ids) store.delete(id);
      return { mutationId: "m" };
    },
    async query(vector: number[], options: { topK: number; filter: Record<string, string> }) {
      const matches = [...store.entries()]
        .filter(([, entry]) => Object.entries(options.filter).every(([key, value]) => entry.metadata[key] === value))
        .map(([id, entry]) => ({ id, score: entry.values.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.topK);
      return { matches, count: matches.length };
    },
  };
}

/** Fake embedding: one dimension per keyword, enough to make meaning-based ranking testable. */
const KEYWORDS = ["modell", "datenrichtlinie", "deepseek", "kontext", "projekt"];
function fakeAi(working = true) {
  return {
    async run(_model: string, input: { text: string[] }) {
      if (!working) throw new Error("4006: daily free allocation used up");
      return { data: input.text.map((text) => KEYWORDS.map((word) => (text.toLowerCase().includes(word) ? 1 : 0))) };
    },
  };
}

function setup(aiWorks = true) {
  const db = sqliteD1();
  const vectors = fakeVectorize();
  db.raw.prepare("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme')").run();
  const env = { DB: db, AI: fakeAi(aiWorks), KNOWLEDGE: vectors } as unknown as Env;
  return { db, env, vectors };
}

describe("chunking", () => {
  it("splits along headings, keeps the heading path, ignores # inside code and bounds the size", () => {
    const chunks = chunkMarkdown(ADR, "docs/adr.md");
    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      "docs/adr.md › ADR 0033: Modellanbieter › Kontext",
      "docs/adr.md › ADR 0033: Modellanbieter › Entscheidung › Datenrichtlinie je Projekt",
    ]);
    expect(chunks[1]?.text).toContain("const x = 1;");
    const long = chunkMarkdown(`# Lang\n\n${"Absatz mit Inhalt. ".repeat(60)}\n\n${"Noch ein Absatz. ".repeat(120)}`, "x.md");
    expect(long.length).toBeGreaterThan(1);
    expect(long.every((chunk) => chunk.text.length <= MAX_CHARS)).toBe(true);
  });

  it("indexes documentation and rules, not code or build output", () => {
    expect(isKnowledgeFile("AGENTS.md", 10)).toBe(true);
    expect(isKnowledgeFile("docs/architecture/decisions/0033-x.md", 10)).toBe(true);
    expect(isKnowledgeFile("apps/api/README.md", 10)).toBe(true);
    expect(isKnowledgeFile("apps/api/src/index.ts", 10)).toBe(false);
    expect(isKnowledgeFile("node_modules/x/README.md", 10)).toBe(false);
    expect(isKnowledgeFile("docs/big.md", 300_000)).toBe(false);
  });

  it("turns a question into a safe full-text expression", () => {
    expect(ftsQuery('Was gilt für "DeepSeek" OR NEAR?')).toBe('"was" OR "gilt" OR "für" OR "deepseek" OR "or" OR "near"');
    expect(ftsQuery("?")).toBeNull();
  });
});

describe("knowledge store", () => {
  it("finds by text even when embeddings are unavailable, and fills vectors in later", async () => {
    const { env, vectors } = setup(false);
    const result = await replaceSource(env, "owner", "p1", "file:docs/adr.md", "sha1", chunkMarkdown(ADR, "docs/adr.md"));
    expect(result).toEqual({ chunks: 2, embedded: false });
    expect(vectors.store.size).toBe(0);
    const hits = await search(env, "owner", "p1", "Datenrichtlinie DeepSeek");
    expect(hits[0]).toMatchObject({ source: "file:docs/adr.md", via: ["text"] });
    expect(hits[0]?.heading).toContain("Datenrichtlinie je Projekt");
    expect(await knowledgeStatus(env, "owner", "p1")).toMatchObject({ sources: 1, chunks: 2, embedded: 0 });

    (env as unknown as { AI: unknown }).AI = fakeAi(true);
    const { embedPending } = await import("../apps/api/src/knowledge/store.ts");
    expect(await embedPending(env, "owner", "p1")).toBe(2);
    expect(vectors.store.size).toBe(2);
  });

  it("combines text and meaning, stays within tenant and project, and cleans up a removed source", async () => {
    const { env, vectors } = setup(true);
    await replaceSource(env, "owner", "p1", "file:docs/adr.md", "sha1", chunkMarkdown(ADR, "docs/adr.md"));
    await replaceSource(env, "acme", "p1", "file:docs/adr.md", "sha1", chunkMarkdown(ADR, "docs/adr.md"));
    const hits = await search(env, "owner", "p1", "Welche Datenrichtlinie gilt für DeepSeek?");
    expect(hits[0]?.via.sort()).toEqual(["text", "vector"]);
    expect(await search(env, "owner", "other", "DeepSeek")).toEqual([]);
    const ownerIds = new Set(hits.map((hit) => hit.chunkId));
    const acmeHits = await search(env, "acme", "p1", "DeepSeek");
    expect(acmeHits.some((hit) => ownerIds.has(hit.chunkId))).toBe(false);

    await removeSource(env, "owner", "p1", "file:docs/adr.md");
    expect(await search(env, "owner", "p1", "DeepSeek")).toEqual([]);
    expect([...vectors.store.values()].every((entry) => entry.metadata.tenant === "acme")).toBe(true);
    expect(await knowledgeStatus(env, "owner", "p1")).toMatchObject({ sources: 0, chunks: 0 });
  });
});

describe("working memory", () => {
  it("is written by the agent's tool and goes first into the context", async () => {
    const { env } = setup(true);
    const [memoryUpdate] = toolsByName(["memory_update"]);
    const context = { env, tenantId: "owner", agentId: "chef", projectId: "p1", repo: "devUgur/p1", budget: new SubrequestBudget() };
    expect(await memoryUpdate!.run({ content: "## Ziele\n- Stufe 3 abnehmen" }, context)).toMatchObject({ saved: true });
    await memoryUpdate!.run({ content: "## Ziele\n- Stufe 3 abgenommen" }, context);
    const memory = await readWorkingMemory(env, "owner", "chef", "p1");
    expect(memory).toMatchObject({ content: "## Ziele\n- Stufe 3 abgenommen", version: 2 });
    expect(await readWorkingMemory(env, "acme", "chef", "p1")).toBeNull();
    const built = buildContext([{ id: 1, role: "user", content: "Hallo" }], 1, { text: "früher", upTo: 0 }, memory?.content);
    expect(built[0]?.content).toContain("Stufe 3 abgenommen");
    expect(built[1]?.content).toContain("früher");
  });
});
