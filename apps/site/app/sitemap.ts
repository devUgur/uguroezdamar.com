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
  const [projects, germanProjects, posts, germanPosts] = await Promise.all([
    getProjects({ includeDrafts: false }),
    getProjects({ includeDrafts: false, locale: "de" }),
    getAllPosts("en"),
    getAllPosts("de"),
  ]);
  const pages = ["/", "/projects", "/contact", "/privacy", "/imprint"];
  if (posts.length > 0 || germanPosts.length > 0) pages.push("/blog");
  if (hasAbout(profile)) pages.push("/about");
  if (hasEducation(profile)) pages.push("/education");
  const germanPagePaths = pages.map((page) => page === "/" ? "/de" : `/de${page}`);
  const urls: MetadataRoute.Sitemap = [];
  for (const [index, page] of pages.entries()) {
    const german = germanPagePaths[index]!;
    const alternates = { languages: { en: `${baseUrl}${page}`, de: `${baseUrl}${german}` } };
    urls.push({ url: `${baseUrl}${page}`, alternates });
    urls.push({ url: `${baseUrl}${german}`, alternates });
  }
  const germanProjectSlugs = new Set(germanProjects.map((project) => project.slug));
  for (const project of projects) {
    const en = `/projects/${project.slug}`;
    const de = `/de/projects/${project.slug}`;
    const alternate = germanProjectSlugs.has(project.slug) ? { languages: { en: `${baseUrl}${en}`, de: `${baseUrl}${de}` } } : undefined;
    urls.push({ url: `${baseUrl}${en}`, lastModified: new Date(project.updatedAt), ...(alternate ? { alternates: alternate } : {}) });
    if (germanProjectSlugs.has(project.slug)) {
      const translated = germanProjects.find((item) => item.slug === project.slug)!;
      urls.push({ url: `${baseUrl}${de}`, lastModified: new Date(translated.updatedAt), alternates: alternate });
    }
  }
  const germanPostSlugs = new Set(germanPosts.map((post) => post.slug));
  for (const post of posts) {
    const en = `/blog/${post.slug}`;
    const de = `/de/blog/${post.slug}`;
    const alternate = germanPostSlugs.has(post.slug) ? { languages: { en: `${baseUrl}${en}`, de: `${baseUrl}${de}` } } : undefined;
    urls.push({ url: `${baseUrl}${en}`, ...(alternate ? { alternates: alternate } : {}) });
    if (germanPostSlugs.has(post.slug)) urls.push({ url: `${baseUrl}${de}`, alternates: alternate });
  }
  return urls;
}
