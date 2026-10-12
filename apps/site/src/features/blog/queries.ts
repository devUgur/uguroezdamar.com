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

export async function getAllPosts(): Promise<PostRecord[]> {
  const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
  const files = entries.filter((entry) => entry.endsWith(".mdx"));

  const posts = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(contentDir, file), "utf8");
      const parsed = parseFrontmatter(raw);

      return {
        slug,
        title: String(parsed.data.title ?? slug),
        summary: String(parsed.data.summary ?? ""),
        date: parsed.data.date ? String(parsed.data.date) : undefined,
        source: parsed.content,
      } satisfies PostRecord;
    }),
  );

  posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return posts;
}

export async function getPostBySlug(slug: string): Promise<PostRecord | null> {
  const filePath = path.join(contentDir, `${slug}.mdx`);
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
