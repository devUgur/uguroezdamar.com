import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { getProjectBySlugMongo, getProjects, type ProjectKind, type ProjectRecord } from "@ugur/server";

const contentDir = path.join(process.cwd(), "content", "projects");

function toProjectKind(value: unknown): ProjectKind | null {
  const kindValue = String(value ?? "").toLowerCase();
  if (kindValue === "web" || kindValue === "mobile" || kindValue === "desktop" || kindValue === "cli") {
    return kindValue;
  }
  if (kindValue === "ios" || kindValue === "android") return "mobile";
  if (kindValue === "terminal") return "cli";
  return null;
}

function mapMdxProject(slug: string, parsed: matter.GrayMatterFile<string>): ProjectRecord {
  const now = new Date().toISOString();
  return {
    _id: slug,
    slug,
    title: String(parsed.data.title ?? slug),
    summary: String(parsed.data.summary ?? ""),
    content: parsed.content,
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
    kinds: Array.isArray(parsed.data.kinds)
      ? parsed.data.kinds.map(toProjectKind).filter((kind): kind is ProjectKind => Boolean(kind))
      : [],
    tech: Array.isArray(parsed.data.tech) ? parsed.data.tech.map(String) : [],
    links: Array.isArray(parsed.data.links)
      ? parsed.data.links
          .map((item: any) => ({
            platform: String(item?.platform ?? item?.label ?? "link"),
            label: item?.label ? String(item.label) : undefined,
            url: item?.url ? String(item.url) : "",
            kind: toProjectKind(item?.kind),
          }))
          .filter((item: any) => !!item.url)
      : [],
    apps: [],
    images: Array.isArray(parsed.data.images)
      ? parsed.data.images
          .map((image: any) => ({
            url: String(image?.url ?? ""),
            alt: image?.alt ? String(image.alt) : undefined,
            kind: image?.kind === "cover" || image?.kind === "gallery" ? image.kind : toProjectKind(image?.kind),
          }))
          .filter((image: any) => !!image.url)
      : [],
    coverImageUrl: parsed.data.coverImageUrl ? String(parsed.data.coverImageUrl) : null,
    previewImageUrl: parsed.data.previewImageUrl ? String(parsed.data.previewImageUrl) : null,
    previewUpdatedAt: null,
    status: "published",
    featured: Boolean(parsed.data.featured ?? false),
    isSecret: Boolean(parsed.data.isSecret ?? false),
    sortIndex: Number(parsed.data.sortIndex ?? 0),
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSiteProjects(): Promise<ProjectRecord[]> {
  if (process.env.MONGODB_URI) {
    try {
      const dbProjects = await getProjects({ status: "published", limit: 500 });
      if (dbProjects.length > 0) return dbProjects;
    } catch (error) {
      console.error("MongoDB projects fetch failed, falling back to MDX:", error);
    }
  }

  const entries = await fs.readdir(contentDir).catch(() => [] as string[]);
  const files = entries.filter((fileName) => fileName.endsWith(".mdx"));

  const projects = await Promise.all(
    files.map(async (fileName) => {
      const slug = fileName.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(contentDir, fileName), "utf8");
      const parsed = matter(raw);
      return mapMdxProject(slug, parsed);
    }),
  );

  return projects;
}

export async function getSiteProjectBySlug(slug: string): Promise<ProjectRecord | null> {
  if (process.env.MONGODB_URI) {
    try {
      const dbProject = await getProjectBySlugMongo(slug);
      if (dbProject && dbProject.status === "published") return dbProject;
    } catch (error) {
      console.error(`MongoDB project fetch for slug ${slug} failed, falling back to MDX:`, error);
    }
  }

  const filePath = path.join(contentDir, `${slug}.mdx`);
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) return null;

  const parsed = matter(raw);
  return mapMdxProject(slug, parsed);
}
