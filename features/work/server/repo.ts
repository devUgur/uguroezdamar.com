import type { WorkItem } from "../types";
import { getAllProjects, getProjectBySlug } from "@/features/projects/server/queries";
import type { ProjectRecord } from "@/features/projects/types";

// Prefer Mongo backend when available, with MDX fallback
let useMongo = false;
let mongoModule: typeof import("./mongo") | null = null;

async function getMongo() {
  if (mongoModule) return mongoModule;
  if (process.env.MONGODB_URI) {
    try {
      mongoModule = await import("./mongo");
      useMongo = true;
      return mongoModule;
    } catch (err) {
      console.error("Failed to load mongo module:", err);
      useMongo = false;
    }
  }
  return null;
}

function projectToWorkItem(p: ProjectRecord): WorkItem {
  return {
    id: p.slug,
    slug: p.slug,
    title: p.title,
    summary: p.summary ?? null,
    content: p.content ?? null,
    tags: p.tags ?? [],
    coverImage: null,
    links: null,
    featured: false,
    status: "published",
    publishedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function getWorkItems(options?: { status?: string; limit?: number }): Promise<WorkItem[]> {
  const mongo = await getMongo();
  if (useMongo && mongo) {
    try {
      return await mongo.getWorkItems(options);
    } catch (err) {
      console.error("MongoDB fetch failed, falling back to MDX:", err);
    }
  }
  
  const projects = await getAllProjects();
  return projects.map(projectToWorkItem);
}

export async function getWorkItemBySlug(slug: string): Promise<WorkItem | null> {
  const mongo = await getMongo();
  if (useMongo && mongo) {
    try {
      return await mongo.getWorkItemBySlug(slug);
    } catch (err) {
      console.error(`MongoDB fetch for slug ${slug} failed, falling back to MDX:`, err);
    }
  }
  
  const p = await getProjectBySlug(slug);
  if (!p) return null;
  return projectToWorkItem(p);
}
