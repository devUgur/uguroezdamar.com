import { getWorkItemBySlug, getWorkItems } from "@/features/work/server/repo";

export async function getSiteWorkItems() {
  return getWorkItems();
}

export async function getSiteWorkItemBySlug(slug: string) {
  return getWorkItemBySlug(slug);
}
