import type { Project } from "@/src/content/projects";
import { ProjectCard } from "@/src/components/public/ProjectCard";

export function SelectedProjectCard({ project, index }: { project: Project; index: number }) {
  return <li><ProjectCard project={project} index={index} headingLevel="h3" /></li>;
}
