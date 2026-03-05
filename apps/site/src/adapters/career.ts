type TimelineSourceItem = {
  slug: string;
  title: string;
  summary?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  type: "project" | "work";
};

export function buildTimeline(projects: TimelineSourceItem[], workItems: TimelineSourceItem[]) {
  return [...projects, ...workItems].sort((a, b) => {
    const left = new Date(a.publishedAt ?? a.createdAt ?? 0).getTime();
    const right = new Date(b.publishedAt ?? b.createdAt ?? 0).getTime();
    return right - left;
  });
}
