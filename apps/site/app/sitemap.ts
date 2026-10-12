import type { MetadataRoute } from "next";
import { getSiteProjects } from "../src/features/projects/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://uguroezdamar.com" : "http://localhost:3000");
  const projects = await getSiteProjects();

  return [
    { url: `${baseUrl}/`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/projects`, lastModified: new Date() },
    { url: `${baseUrl}/blog`, lastModified: new Date() },
    { url: `${baseUrl}/work`, lastModified: new Date() },
    { url: `${baseUrl}/education`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
    { url: `${baseUrl}/privacy`, lastModified: new Date() },
    { url: `${baseUrl}/imprint`, lastModified: new Date() },
    ...projects.map((project) => ({
      url: `${baseUrl}/projects/${project.slug}`,
      lastModified: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    })),
  ];
}
