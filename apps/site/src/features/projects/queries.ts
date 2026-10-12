import "server-only";
import { env, getProjectBySlugMongo, getProjects, type ProjectRecord } from "@ugur/server";

function requireContentDatabase() {
  if (env.MONGODB_URI) return true;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") return false;
  throw new Error("MONGODB_URI must be configured for the public site content service.");
}

/** Published, non-secret projects from the CMS are the public source of truth. */
export async function getSiteProjects(): Promise<ProjectRecord[]> {
  if (!requireContentDatabase()) return [];
  return getProjects({ status: "published", publicOnly: true, limit: 500 });
}

export async function getSiteProjectBySlug(slug: string): Promise<ProjectRecord | null> {
  if (!requireContentDatabase()) return null;
  return getProjectBySlugMongo(slug.toLowerCase(), { publicOnly: true });
}
