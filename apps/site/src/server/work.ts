import { getWorkItemBySlug, getWorkItems, type ProjectRecord, type WorkItem } from "@ugur/server";
import { getSiteProjectBySlug, getSiteProjects } from "./projects";

function projectToWorkItem(project: ProjectRecord): WorkItem {
  return {
    id: project.slug,
    slug: project.slug,
    title: project.title,
    summary: project.summary ?? null,
    content: project.content ?? null,
    tags: project.tags ?? [],
    coverImage: null,
    links: null,
    featured: false,
    status: "published",
    publishedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function getSiteWorkItems(): Promise<WorkItem[]> {
  if (process.env.MONGODB_URI) {
    try {
      return await getWorkItems();
    } catch (error) {
      console.error("MongoDB work fetch failed, falling back to projects MDX:", error);
    }
  }

  const projects = await getSiteProjects();
  return projects.map(projectToWorkItem);
}

export async function getSiteWorkItemBySlug(slug: string): Promise<WorkItem | null> {
  if (process.env.MONGODB_URI) {
    try {
      return await getWorkItemBySlug(slug);
    } catch (error) {
      console.error(`MongoDB work fetch for slug ${slug} failed, falling back to projects MDX:`, error);
    }
  }

  const project = await getSiteProjectBySlug(slug);
  if (!project) return null;
  return projectToWorkItem(project);
}
