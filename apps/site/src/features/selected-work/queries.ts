import { getSiteProjects, getSiteProjectBySlug } from "../projects/queries";
import type { ProjectRecord } from "@ugur/server";

export async function getSiteWorkItems(): Promise<ProjectRecord[]> {
  const projects = await getSiteProjects();
  return projects.filter((project) => project.featured);
}

/** Slugs for static export (work detail pages). */
export async function getSiteWorkSlugs(): Promise<{ slug: string }[]> {
  const items = await getSiteWorkItems();
  return items.map((p) => ({ slug: p.slug }));
}

export async function getSiteWorkItemBySlug(slug: string): Promise<ProjectRecord | null> {
  const project = await getSiteProjectBySlug(slug);
  return project?.featured ? project : null;
}
