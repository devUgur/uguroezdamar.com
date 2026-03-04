import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

export type PostRecord = {
  slug: string;
  title: string;
  summary: string;
  date?: string;
  source: string;
};

async function resolveContentDir() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "content", "blog"),
    path.join(cwd, "apps", "site", "content", "blog"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return candidates[0];
}

export async function getAllPosts(): Promise<PostRecord[]> {
  const contentDir = await resolveContentDir();
  const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
  const files = entries.filter((entry) => entry.endsWith(".mdx"));

  const posts = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(contentDir, file), "utf8");
      const parsed = matter(raw);

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
  const contentDir = await resolveContentDir();
  const filePath = path.join(contentDir, `${slug}.mdx`);
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) {
    return null;
  }

  const parsed = matter(raw);
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
