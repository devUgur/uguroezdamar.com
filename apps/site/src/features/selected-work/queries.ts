import { getProjects, getProjectBySlugMongo, type ProjectRecord } from "@ugur/server";
import { getSiteProjects, getSiteProjectBySlug } from "../projects/queries";

export async function getSiteWorkItems(): Promise<ProjectRecord[]> {
  if (process.env.MONGODB_URI) {
    try {
      return await getProjects({ status: "published", featured: true });
    } catch (error) {
      console.error("MongoDB projects fetch failed, falling back to MDX:", error);
    }
  }

  const projects = await getSiteProjects();
  return projects.filter((p) => p.featured);
}

/** Slugs for static export (work detail pages). */
export async function getSiteWorkSlugs(): Promise<{ slug: string }[]> {
  const items = await getSiteWorkItems();
  return items.map((p) => ({ slug: p.slug }));
}

export async function getSiteWorkItemBySlug(slug: string): Promise<ProjectRecord | null> {
  if (process.env.MONGODB_URI) {
    try {
      return await getProjectBySlugMongo(slug);
    } catch (error) {
      console.error(`MongoDB project fetch for slug ${slug} failed, falling back to MDX:`, error);
    }
  }

  return getSiteProjectBySlug(slug);
}
