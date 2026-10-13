import "server-only";

import { contentDir, isValidSlug, readContentFile, readContentFiles, type ContentFile } from "@/src/content/mdx";

import type { PostRecord } from "./types";

const blogDir = () => contentDir("blog");

export function isValidBlogSlug(slug: string): boolean {
  return isValidSlug(slug);
}

function toPost(file: ContentFile): PostRecord {
  return {
    slug: file.slug,
    title: String(file.data.title ?? file.slug),
    summary: String(file.data.summary ?? ""),
    date: file.data.date ? String(file.data.date) : undefined,
    source: file.content,
  };
}

export async function getAllPosts(): Promise<PostRecord[]> {
  const posts = (await readContentFiles(blogDir())).map(toPost);
  posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return posts;
}

export async function getPostBySlug(slug: string): Promise<PostRecord | null> {
  const file = await readContentFile(blogDir(), slug);
  return file ? toPost(file) : null;
}
