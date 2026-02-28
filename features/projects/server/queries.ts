import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

export type ProjectRecord = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  content: string;
};

const contentDir = path.join(process.cwd(), "content", "projects");

export async function getAllProjects(): Promise<ProjectRecord[]> {
  const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".mdx"));

  const projects = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(contentDir, file), "utf8");
      const parsed = matter(raw);

      return {
        slug,
        title: String(parsed.data.title ?? slug),
        summary: String(parsed.data.summary ?? ""),
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
        content: parsed.content,
      } satisfies ProjectRecord;
    }),
  );

  return projects;
}

export async function getProjectBySlug(slug: string): Promise<ProjectRecord | null> {
  const filePath = path.join(contentDir, `${slug}.mdx`);
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) return null;

  const parsed = matter(raw);
  return {
    slug,
    title: String(parsed.data.title ?? slug),
    summary: String(parsed.data.summary ?? ""),
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
    content: parsed.content,
  } satisfies ProjectRecord;
}
