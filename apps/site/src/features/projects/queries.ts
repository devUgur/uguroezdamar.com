import "server-only";
import { env, getProjectBySlug, getProjects, type ProjectRecord } from "@ugur/server";

function requireContentDatabase() {
  if (env.DATABASE_URL) return true;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") return false;
  throw new Error("DATABASE_URL must be configured for the public site content service.");
}

/** Published, non-secret projects from the CMS are the public source of truth. */
export async function getSiteProjects(): Promise<ProjectRecord[]> {
  if (!requireContentDatabase()) return [];
  try {
    return await getProjects({ status: "published", publicOnly: true, limit: 500 });
  } catch {
    console.error("Public projects could not be loaded from database.");
    return [];
  }
}

export async function getSiteProjectBySlug(slug: string): Promise<ProjectRecord | null> {
  if (!requireContentDatabase()) return null;
  try {
    return await getProjectBySlug(slug.toLowerCase(), { publicOnly: true });
  } catch {
    console.error("Public project could not be loaded from database.");
    return null;
  }
}
