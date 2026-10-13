import type { MetadataRoute } from "next";

import profile from "@/content/profile";
import { hasAbout, hasEducation } from "@/src/content/profile";
import { getProjects } from "@/src/content/projects";
import { getAllPosts } from "@/src/features/blog/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A preview deployment has no address of its own in the secrets; Vercel names it.
  const preview = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? preview ?? (process.env.NODE_ENV === "production" ? "https://uguroezdamar.com" : "http://localhost:3100");
  // Drafts are never listed, whatever the environment.
  const projects = await getProjects({ includeDrafts: false });
  // A page without content is reachable but not advertised to search engines.
  const pages = ["/", "/projects", "/contact", "/privacy", "/imprint"];
  if ((await getAllPosts()).length > 0) pages.push("/blog");
  if (hasAbout(profile)) pages.push("/about");
  if (hasEducation(profile)) pages.push("/education");

  return [
    ...pages.map((page) => ({ url: `${baseUrl}${page}` })),
    ...projects.map((project) => ({
      url: `${baseUrl}/projects/${project.slug}`,
      lastModified: new Date(project.updatedAt),
    })),
  ];
}
