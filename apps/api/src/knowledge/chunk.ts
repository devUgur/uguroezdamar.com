/**
 * Splits a Markdown document into retrievable pieces (plan stage 3): along headings first, then by paragraphs so no
 * piece exceeds MAX_CHARS. Each piece keeps its heading path, which the search result shows as the source.
 */
export const MAX_CHARS = 1_500;
const MIN_CHARS = 80;

export interface Chunk {
  heading: string;
  text: string;
}

export function chunkMarkdown(source: string, title: string): Chunk[] {
  const sections: Chunk[] = [];
  const path: string[] = [];
  let buffer: string[] = [];
  let inFence = false;
  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (text) sections.push({ heading: [title, ...path].filter(Boolean).join(" › "), text });
  };
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence ? line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/) : null;
    if (heading) {
      flush();
      const level = heading[1]!.length;
      path.length = level - 1;
      path[level - 1] = heading[2]!;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections.flatMap(split).filter((chunk) => chunk.text.length >= MIN_CHARS || sections.length === 1);
}

function split(section: Chunk): Chunk[] {
  if (section.text.length <= MAX_CHARS) return [section];
  const pieces: Chunk[] = [];
  let current = "";
  for (const paragraph of section.text.split(/\n{2,}/)) {
    const parts = paragraph.length > MAX_CHARS ? paragraph.match(new RegExp(`[\\s\\S]{1,${MAX_CHARS}}`, "g")) ?? [] : [paragraph];
    for (const part of parts) {
      if (current && current.length + part.length + 2 > MAX_CHARS) {
        pieces.push({ heading: section.heading, text: current.trim() });
        current = "";
      }
      current += (current ? "\n\n" : "") + part;
    }
  }
  if (current.trim()) pieces.push({ heading: section.heading, text: current.trim() });
  return pieces;
}

/** Repository files worth indexing: documentation and agent rules, not code (code is searched live). */
export function isKnowledgeFile(path: string, size: number): boolean {
  if (size > 200_000) return false;
  if (/(^|\/)(node_modules|dist|build|\.next|vendor)\//.test(path)) return false;
  if (/(^|\/)(AGENTS|CLAUDE|README|CONTRIBUTING|PLAN|CHANGELOG)\.md$/i.test(path)) return true;
  return /^docs\/.+\.mdx?$/i.test(path) || /^[^/]+\.md$/i.test(path);
}

/** Stable id of a chunk, short enough for Vectorize (64 bytes). */
export async function chunkId(tenantId: string, projectId: string, source: string, index: number): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${tenantId}\u0000${projectId}\u0000${source}\u0000${index}`));
  return [...new Uint8Array(digest)].slice(0, 20).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
