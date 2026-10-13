import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { parse } from "yaml";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Where the repository keeps the site's content, e.g. `content/projects`. */
export function contentDir(...segments: string[]): string {
  return path.join(process.cwd(), "content", ...segments);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const data: unknown = parse(match[1] ?? "");
  return {
    data: data && typeof data === "object" ? (data as Record<string, unknown>) : {},
    content: match[2] ?? "",
  };
}

export interface ContentFile {
  slug: string;
  data: Record<string, unknown>;
  content: string;
}

/** Reads `<dir>/<slug>.mdx`. A slug that is not a plain file name in `dir` yields `null`. */
export async function readContentFile(dir: string, slug: string): Promise<ContentFile | null> {
  if (!isValidSlug(slug)) return null;
  const filePath = path.join(dir, `${slug}.mdx`);
  const info = await fs.lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) return null;
  const raw = await fs.readFile(filePath, "utf8");
  return { slug, ...parseFrontmatter(raw) };
}

/** Every `<slug>.mdx` in `dir`; a missing directory is an empty collection. */
export async function readContentFiles(dir: string): Promise<ContentFile[]> {
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const slugs = entries.filter((entry) => entry.endsWith(".mdx")).map((entry) => entry.slice(0, -4));
  const files = await Promise.all(slugs.map((slug) => readContentFile(dir, slug)));
  return files.flatMap((file) => (file ? [file] : []));
}

export async function compileMdx(source: string) {
  const { content } = await compileMDX({
    source,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
  });
  return content;
}
