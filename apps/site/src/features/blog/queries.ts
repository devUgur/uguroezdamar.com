import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import type { PostRecord } from "./types";

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {} as Record<string, unknown>, content: raw };
  const data = parse(match[1]);
  return {
    data: data && typeof data === "object" ? data as Record<string, unknown> : {},
    content: match[2],
  };
}

const contentDir = path.join(process.cwd(), "content", "blog");
const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getPostFilePath(slug: string): string | null {
  if (!BLOG_SLUG_PATTERN.test(slug)) return null;
  const root = path.resolve(contentDir);
  const filePath = path.resolve(root, `${slug}.mdx`);
  const relativePath = path.relative(root, filePath);
  if (relativePath.startsWith(`..${path.sep}`) || relativePath === ".." || path.isAbsolute(relativePath)) return null;
  return filePath;
}

export function isValidBlogSlug(slug: string): boolean {
  return getPostFilePath(slug) !== null;
}

export async function getAllPosts(): Promise<PostRecord[]> {
  const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
  const files = entries.filter((entry) => entry.endsWith(".mdx") && isValidBlogSlug(entry.slice(0, -4)));

  const posts = await Promise.all(
    files.map(async (file): Promise<PostRecord | null> => {
      const slug = file.replace(/\.mdx$/, "");
      const filePath = getPostFilePath(slug);
      if (!filePath) return null;
      const fileInfo = await fs.lstat(filePath).catch(() => null);
      if (!fileInfo?.isFile() || fileInfo.isSymbolicLink()) return null;
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = parseFrontmatter(raw);

      return {
        slug,
        title: String(parsed.data.title ?? slug),
        summary: String(parsed.data.summary ?? ""),
        date: parsed.data.date ? String(parsed.data.date) : undefined,
        source: parsed.content,
      };
    }),
  );

  const validPosts = posts.flatMap((post) => post ? [post] : []);
  validPosts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return validPosts;
}

export async function getPostBySlug(slug: string): Promise<PostRecord | null> {
  const filePath = getPostFilePath(slug);
  if (!filePath) return null;
  const fileInfo = await fs.lstat(filePath).catch(() => null);
  if (!fileInfo?.isFile() || fileInfo.isSymbolicLink()) return null;
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) {
    return null;
  }

  const parsed = parseFrontmatter(raw);
  return {
    slug,
    title: String(parsed.data.title ?? slug),
    summary: String(parsed.data.summary ?? ""),
    date: parsed.data.date ? String(parsed.data.date) : undefined,
    source: parsed.content,
  } satisfies PostRecord;
}

export async function compileMdx(source: string) {
  const { content } = await compileMDX({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
      },
    },
  });

  return content;
}
