import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import type { ProjectKind, ProjectRecord } from "../types";
import { getProjectBySlugMongo, getProjects } from "./mongo";

const contentDir = path.join(process.cwd(), "content", "projects");

function toProjectKind(value: unknown): ProjectKind | null {
  const v = String(value ?? "").toLowerCase();
  if (v === "web" || v === "mobile" || v === "desktop" || v === "cli") return v;
  if (v === "ios" || v === "android") return "mobile";
  if (v === "terminal") return "cli";
  return null;
}

function mapMdxProject(slug: string, parsed: matter.GrayMatterFile<string>): ProjectRecord {
  return {
    slug,
    title: String(parsed.data.title ?? slug),
    summary: String(parsed.data.summary ?? ""),
    content: parsed.content,
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
    kinds: Array.isArray(parsed.data.kinds)
      ? parsed.data.kinds.map(toProjectKind).filter((k): k is ProjectKind => Boolean(k))
      : [],
    tech: Array.isArray(parsed.data.tech) ? parsed.data.tech.map(String) : [],
    links: Array.isArray(parsed.data.links)
      ? parsed.data.links
          .map((item: any) => ({
            platform: String(item?.platform ?? item?.label ?? "link"),
            label: item?.label ? String(item.label) : null,
            url: item?.url ? String(item.url) : "",
            kind: toProjectKind(item?.kind),
          }))
          .filter((item: any) => !!item.url)
      : [],
    images: Array.isArray(parsed.data.images)
      ? parsed.data.images
          .map((img: any) => ({
            url: String(img?.url ?? ""),
            alt: img?.alt ? String(img.alt) : null,
            kind: img?.kind === "cover" || img?.kind === "gallery" ? img.kind : toProjectKind(img?.kind),
          }))
          .filter((img: any) => !!img.url)
      : [],
    coverImageUrl: parsed.data.coverImageUrl ? String(parsed.data.coverImageUrl) : null,
    previewImageUrl: parsed.data.previewImageUrl ? String(parsed.data.previewImageUrl) : null,
    status: "published",
    featured: Boolean(parsed.data.featured ?? false),
    sortIndex: Number(parsed.data.sortIndex ?? 0),
    publishedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function getAllProjects(): Promise<ProjectRecord[]> {
  if (process.env.MONGODB_URI) {
    try {
      const dbProjects = await getProjects({ includeDrafts: false, limit: 500 });
      if (dbProjects.length > 0) return dbProjects;
    } catch (err) {
      console.error("MongoDB projects fetch failed, falling back to MDX:", err);
    }
  }

  const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".mdx"));

  const projects = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(contentDir, file), "utf8");
      const parsed = matter(raw);

      return mapMdxProject(slug, parsed);
    }),
  );

  return projects;
}

export async function getProjectBySlug(slug: string): Promise<ProjectRecord | null> {
  if (process.env.MONGODB_URI) {
    try {
      const dbProject = await getProjectBySlugMongo(slug, { includeDrafts: false });
      if (dbProject) return dbProject;
    } catch (err) {
      console.error(`MongoDB project fetch for slug ${slug} failed, falling back to MDX:`, err);
    }
  }

  const filePath = path.join(contentDir, `${slug}.mdx`);
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) return null;

  const parsed = matter(raw);
  return mapMdxProject(slug, parsed);
}
