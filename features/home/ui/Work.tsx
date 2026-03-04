import { getAllProjects } from "@/features/projects/server/queries";
import WorkClient, { type DeviceType, type SelectedWorkProject } from "./WorkClient";

function toYearLabel(value?: string | null) {
  if (!value) return String(new Date().getFullYear());
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(new Date().getFullYear());
  return String(date.getUTCFullYear());
}

function toTypes(platforms: string[]): DeviceType[] {
  const mapped = new Set<DeviceType>();
  for (const platform of platforms) {
    const p = platform.toLowerCase();
    if (p.includes("ios") || p.includes("android") || p.includes("mobile")) mapped.add("mobile");
    else if (p.includes("cli") || p.includes("terminal")) mapped.add("cli");
    else mapped.add("web");
  }
  return mapped.size ? Array.from(mapped) : ["web"];
}

export async function Work() {
  const projects = await getAllProjects();
  const mapped: SelectedWorkProject[] = projects.map((project) => {
    // Determine the device type to show based on available images
    // If we have a mobile image, we might want to show that by default if the project is mobile-first
    const types = project.kinds && project.kinds.length > 0 
      ? project.kinds as DeviceType[] 
      : toTypes((project.links ?? []).map((link) => link.platform));

    return {
      slug: project.slug,
      name: project.title,
      year: toYearLabel(project.publishedAt || project.createdAt),
      role: project.kinds?.[0] || "Project",
      stack: project.tech?.slice(0, 3).join(", ") || project.tags?.slice(0, 3).join(", ") || "Tech Stack",
      types,
      // Map images to their respective device types
      deviceImages: {
        web: project.images?.find(img => img.kind === 'web')?.url || project.previewImageUrl || project.coverImageUrl || "",
        mobile: project.images?.find(img => img.kind === 'mobile')?.url || project.previewImageUrl || project.coverImageUrl || "",
        cli: project.images?.find(img => img.kind === 'cli')?.url || project.previewImageUrl || project.coverImageUrl || "",
      },
      image: project.previewImageUrl || project.coverImageUrl || project.images?.[0]?.url || "/favicon.ico",
      description: project.summary || "Project details coming soon.",
    };
  });

  return <WorkClient projects={mapped} />;
}

export default Work;
