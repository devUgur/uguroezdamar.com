import type { ProjectRecord } from "@ugur/server";
import { getSiteWorkItems } from "@/src/adapters/work";
import WorkClient, { type DeviceType, type SelectedWorkProject, type WorkImage, type WorkApp } from "./WorkClient";

function toYearLabel(project: ProjectRecord): string {
  if (project.ongoing) return "Ongoing";
  if (project.yearTo != null) return String(project.yearTo);
  if (project.yearFrom != null) return String(project.yearFrom);
  const value = project.publishedAt || project.createdAt;
  if (!value) return String(new Date().getFullYear());
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(new Date().getFullYear());
  return String(date.getUTCFullYear());
}

function buildImagesByKind(project: ProjectRecord): Partial<Record<DeviceType, WorkImage[]>> {
  const fallbackUrl = project.previewImageUrl || project.coverImageUrl;
  const fallbackImg = fallbackUrl ? [{ url: fallbackUrl, alt: project.title }] : [];
  const kinds: DeviceType[] = ["web", "mobile", "desktop", "cli"];
  const result: Partial<Record<DeviceType, WorkImage[]>> = {};

  for (const kind of kinds) {
    const fromProject = (project.images ?? []).filter((i) => i.kind === kind).map((img) => ({ url: img.url, alt: img.alt ?? undefined, kind: img.kind ?? undefined }));
    const fromApp = (project.apps ?? []).find((a) => a.kind === kind);
    const appImgs = (fromApp?.images ?? []).map((img) => ({ url: img.url, alt: img.alt ?? undefined, kind: img.kind ?? undefined }));
    const combined = fromProject.length ? fromProject : appImgs;
    if (combined.length > 0) result[kind] = combined;
    else if (fallbackImg.length) result[kind] = fallbackImg;
  }
  return result;
}

function buildDeviceImages(project: ProjectRecord): Record<DeviceType, string> {
  const fallback = project.previewImageUrl || project.coverImageUrl || "";
  const byKind = (kind: string) => {
    const fromProject = (project.images ?? []).find((i) => i.kind === kind);
    if (fromProject?.url) return fromProject.url;
    const fromApp = (project.apps ?? []).find((a) => a.kind === kind);
    const img = fromApp?.images?.[0];
    if (img?.url) return img.url;
    return fallback;
  };
  return {
    web: byKind("web") || fallback,
    mobile: byKind("mobile") || fallback,
    desktop: byKind("desktop") || fallback,
    cli: byKind("cli") || fallback,
  };
}

export async function Work() {
  const projects = await getSiteWorkItems();
  const mapped: SelectedWorkProject[] = projects.map((project) => {
    const types: DeviceType[] =
      project.kinds && project.kinds.length > 0
        ? (project.kinds as DeviceType[])
        : (project.apps ?? []).length > 0
          ? (project.apps!.map((a) => a.kind) as DeviceType[])
          : ["web"];

    const apps: WorkApp[] = (project.apps ?? []).map((app) => ({
      kind: app.kind as DeviceType,
      repoUrl: app.repoUrl ?? undefined,
      images: (app.images ?? []).map((img) => ({ url: img.url, alt: img.alt ?? undefined, kind: img.kind ?? undefined })),
      tags: app.tags ?? undefined,
      tech: app.tech ?? undefined,
    }));

    return {
      slug: project.slug,
      name: project.title,
      year: toYearLabel(project),
      role: project.tags?.[0] || "Project",
      stack: (project.tech ?? project.tags ?? []).slice(0, 3).join(", ") || "Tech Stack",
      types,
      deviceImages: buildDeviceImages(project),
      image: project.previewImageUrl || project.coverImageUrl || "/favicon.ico",
      description: project.summary || "Project details coming soon.",
      imagesByKind: buildImagesByKind(project),
      apps,
      links: project.links ?? undefined,
      tech: project.tech ?? undefined,
      tags: project.tags ?? undefined,
    };
  });

  return <WorkClient projects={mapped} />;
}

export default Work;
