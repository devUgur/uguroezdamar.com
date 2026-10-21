import type { Project } from "@/src/content/projects";
import { ProjectCard } from "@/src/components/public/ProjectCard";

export function SelectedProjectCard({ project, index, preloadCover }: { project: Project; index: number; preloadCover: boolean }) {
  return <li><ProjectCard project={project} index={index} headingLevel="h3" preloadCover={preloadCover} /></li>;
}
