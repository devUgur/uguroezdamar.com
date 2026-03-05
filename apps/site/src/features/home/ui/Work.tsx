import { getSiteWorkItems } from "@/src/adapters/work";
import WorkClient, { type DeviceType, type SelectedWorkProject } from "./WorkClient";

function toYearLabel(value?: string | null) {
  if (!value) return String(new Date().getFullYear());
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(new Date().getFullYear());
  return String(date.getUTCFullYear());
}

export async function Work() {
  const projects = await getSiteWorkItems();
  const mapped: SelectedWorkProject[] = projects.map((project) => {
    // Standardize kinds to DeviceType
    const types: DeviceType[] = (project.kinds && project.kinds.length > 0) 
      ? (project.kinds as DeviceType[]) 
      : ["web"];

    return {
      slug: project.slug,
      name: project.title,
      year: toYearLabel(project.publishedAt || project.createdAt),
      role: project.tags?.[0] || "Project",
      stack: project.tags?.slice(0, 3).join(", ") || "Tech Stack",
      types,
      deviceImages: {
        web: project.previewImageUrl || project.coverImageUrl || "",
        mobile: project.previewImageUrl || project.coverImageUrl || "",
        cli: project.previewImageUrl || project.coverImageUrl || "",
      },
      image: project.previewImageUrl || project.coverImageUrl || "/favicon.ico",
      description: project.summary || "Project details coming soon.",
    };
  });

  return <WorkClient projects={mapped} />;
}

export default Work;
