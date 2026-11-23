import type { Project } from "@/src/content/projects";
import { ProjectCard } from "@/src/components/public/ProjectCard";
import { type Locale } from "@/src/features/navigation/copy";

export function SelectedProjectCard({ project, index, preloadCover, locale = "en" }: { project: Project; index: number; preloadCover: boolean; locale?: Locale }) {
  return <li><ProjectCard project={project} index={index} headingLevel="h3" preloadCover={preloadCover} locale={locale} /></li>;
}
