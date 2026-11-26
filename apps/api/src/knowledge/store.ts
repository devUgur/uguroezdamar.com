import type { Env } from "../env.ts";
import { type Chunk, chunkId } from "./chunk.ts";

/**
 * The knowledge index of a project (plan stage 3): chunk text in D1 with a full-text index (BM25), vectors in
 * Vectorize. Search combines both (hybrid, reciprocal rank fusion), so it still works while embeddings are not
 * available, e.g. when the free Workers AI allocation is used up; missing vectors are added on the next indexing.
 */
export const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const EMBED_BATCH = 50;
const RRF_K = 60;

export interface SearchHit {
  chunkId: string;
  source: string;
  heading: string | null;
  text: string;
  score: number;
  /** Which part of the search found it. */
  via: ("text" | "vector")[];
}

export async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH) {
    const output = (await env.AI.run(EMBEDDING_MODEL as keyof AiModels, { text: texts.slice(start, start + EMBED_BATCH) } as never)) as { data?: number[][] };
    if (!output.data?.length) throw new Error("Embedding ohne Ergebnis");
    vectors.push(...output.data);
  }
  return vectors;
}

/** Replaces all chunks of one source. Text and full-text index always; vectors only if embedding works. */
export async function replaceSource(env: Env, tenantId: string, projectId: string, source: string, version: string, chunks: Chunk[]): Promise<{ chunks: number; embedded: boolean }> {
  await removeSource(env, tenantId, projectId, source);
  const ids = await Promise.all(chunks.map((_, index) => chunkId(tenantId, projectId, source, index)));
  const statements = chunks.flatMap((chunk, index) => [
    env.DB.prepare("INSERT INTO knowledge_chunks (id, tenant_id, project_id, source, heading, text) VALUES (?, ?, ?, ?, ?, ?)").bind(ids[index], tenantId, projectId, source, chunk.heading, chunk.text),
    env.DB.prepare("INSERT INTO knowledge_fts (chunk_id, tenant_id, project_id, heading, text) VALUES (?, ?, ?, ?, ?)").bind(ids[index], tenantId, projectId, chunk.heading, chunk.text),
  ]);
  statements.push(
    env.DB.prepare(
      `INSERT INTO knowledge_sources (tenant_id, project_id, source, version, chunks) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (tenant_id, project_id, source) DO UPDATE SET version = excluded.version, chunks = excluded.chunks, indexed_at = unixepoch()`,
    ).bind(tenantId, projectId, source, version, chunks.length),
  );
  for (let start = 0; start < statements.length; start += 90) await env.DB.batch(statements.slice(start, start + 90));
  const embedded = await embedPending(env, tenantId, projectId, ids).then(() => true, (error: unknown) => {
    console.error("knowledge embedding failed", error instanceof Error ? error.message : error);
    return false;
  });
  return { chunks: chunks.length, embedded };
}

/** Embeds the given chunks (or every chunk of the project still without vector) and marks them. */
export async function embedPending(env: Env, tenantId: string, projectId: string, ids?: string[]): Promise<number> {
  const rows = ids?.length
    ? (await env.DB.prepare(`SELECT id, heading, text FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ? AND embedded = 0 AND id IN (${ids.map(() => "?").join(",")})`)
        .bind(tenantId, projectId, ...ids)
        .all<{ id: string; heading: string | null; text: string }>()).results
    : (await env.DB.prepare("SELECT id, heading, text FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ? AND embedded = 0 LIMIT 200")
        .bind(tenantId, projectId)
        .all<{ id: string; heading: string | null; text: string }>()).results;
  if (!rows.length) return 0;
  const vectors = await embed(env, rows.map((row) => `${row.heading ?? ""}\n${row.text}`));
  await env.KNOWLEDGE.upsert(rows.map((row, index) => ({ id: row.id, values: vectors[index] ?? [], metadata: { tenant: tenantId, project: projectId } })));
  await env.DB.batch(rows.map((row) => env.DB.prepare("UPDATE knowledge_chunks SET embedded = 1 WHERE tenant_id = ? AND id = ?").bind(tenantId, row.id)));
  return rows.length;
}

export async function removeSource(env: Env, tenantId: string, projectId: string, source: string): Promise<void> {
  const { results } = await env.DB.prepare("SELECT id FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ? AND source = ?").bind(tenantId, projectId, source).all<{ id: string }>();
  if (results.length) await env.KNOWLEDGE.deleteByIds(results.map((row) => row.id)).catch((error: unknown) => console.error("knowledge vector delete failed", error));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM knowledge_fts WHERE tenant_id = ? AND project_id = ? AND chunk_id IN (SELECT id FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ? AND source = ?)").bind(tenantId, projectId, tenantId, projectId, source),
    env.DB.prepare("DELETE FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ? AND source = ?").bind(tenantId, projectId, source),
    env.DB.prepare("DELETE FROM knowledge_sources WHERE tenant_id = ? AND project_id = ? AND source = ?").bind(tenantId, projectId, source),
  ]);
}

/** Words of a query as an FTS5 expression: each term quoted (no operator injection), any term may match. */
export function ftsQuery(query: string): string | null {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? [])].slice(0, 12);
  return terms.length ? terms.map((term) => `"${term.replace(/"/g, "")}"`).join(" OR ") : null;
}

export async function search(env: Env, tenantId: string, projectId: string, query: string, topK = 6): Promise<SearchHit[]> {
  const limit = Math.min(Math.max(topK, 1), 12);
  const expression = ftsQuery(query);
  const [textHits, vectorHits] = await Promise.all([
    expression
      ? env.DB.prepare("SELECT chunk_id AS id FROM knowledge_fts WHERE knowledge_fts MATCH ? AND tenant_id = ? AND project_id = ? ORDER BY bm25(knowledge_fts) LIMIT ?")
          .bind(expression, tenantId, projectId, limit * 2)
          .all<{ id: string }>()
          .then((result) => result.results.map((row) => row.id))
      : Promise.resolve([] as string[]),
    embed(env, [query])
      .then(([vector]) => env.KNOWLEDGE.query(vector ?? [], { topK: limit * 2, filter: { tenant: tenantId, project: projectId } }))
      .then((result) => result.matches.map((match) => match.id))
      .catch(() => [] as string[]),
  ]);
  const fused = new Map<string, { score: number; via: Set<"text" | "vector"> }>();
  const add = (ids: string[], via: "text" | "vector") =>
    ids.forEach((id, rank) => {
      const entry = fused.get(id) ?? { score: 0, via: new Set() };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.via.add(via);
      fused.set(id, entry);
    });
  add(textHits, "text");
  add(vectorHits, "vector");
  const ranked = [...fused.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);
  if (!ranked.length) return [];
  const { results } = await env.DB.prepare(`SELECT id, source, heading, text FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ? AND id IN (${ranked.map(() => "?").join(",")})`)
    .bind(tenantId, projectId, ...ranked.map(([id]) => id))
    .all<{ id: string; source: string; heading: string | null; text: string }>();
  const byId = new Map(results.map((row) => [row.id, row]));
  return ranked.flatMap(([id, entry]) => {
    const row = byId.get(id);
    return row ? [{ chunkId: id, source: row.source, heading: row.heading, text: row.text, score: entry.score, via: [...entry.via] }] : [];
  });
}

export async function knowledgeStatus(env: Env, tenantId: string, projectId: string) {
  const [sources, chunks] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n, MAX(indexed_at) AS last FROM knowledge_sources WHERE tenant_id = ? AND project_id = ?").bind(tenantId, projectId).first<{ n: number; last: number | null }>(),
    env.DB.prepare("SELECT COUNT(*) AS n, SUM(embedded) AS embedded FROM knowledge_chunks WHERE tenant_id = ? AND project_id = ?").bind(tenantId, projectId).first<{ n: number; embedded: number | null }>(),
  ]);
  return { sources: sources?.n ?? 0, lastIndexedAt: sources?.last ?? null, chunks: chunks?.n ?? 0, embedded: Number(chunks?.embedded ?? 0) };
}

// Working memory -------------------------------------------------------------------------------------------------

export const WORKING_MEMORY_CHARS = 4_000;

export async function readWorkingMemory(env: Env, tenantId: string, agentId: string, projectId: string): Promise<{ content: string; version: number; updatedAt: number } | null> {
  const row = await env.DB.prepare("SELECT content, version, updated_at FROM working_memory WHERE tenant_id = ? AND agent_id = ? AND project_id = ?")
    .bind(tenantId, agentId, projectId)
    .first<{ content: string; version: number; updated_at: number }>();
  return row ? { content: row.content, version: row.version, updatedAt: row.updated_at } : null;
}

export async function writeWorkingMemory(env: Env, tenantId: string, agentId: string, projectId: string, content: string): Promise<number> {
  const text = content.trim().slice(0, WORKING_MEMORY_CHARS);
  await env.DB.prepare(
    `INSERT INTO working_memory (tenant_id, agent_id, project_id, content) VALUES (?, ?, ?, ?)
     ON CONFLICT (tenant_id, agent_id, project_id) DO UPDATE SET content = excluded.content, version = working_memory.version + 1, updated_at = unixepoch()`,
  )
    .bind(tenantId, agentId, projectId, text)
    .run();
  return text.length;
}
