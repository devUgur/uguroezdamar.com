import { getAllProjects, getProjectBySlug } from "@/features/projects/server/queries";

export async function getSiteProjects() {
  return getAllProjects();
}

export async function getSiteProjectBySlug(slug: string) {
  return getProjectBySlug(slug);
}
