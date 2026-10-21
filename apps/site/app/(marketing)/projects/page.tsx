import type { Metadata } from "next";

import { getProjects } from "@/src/content/projects";
import { ProjectGrid } from "@/src/features/projects";

export const metadata: Metadata = {
  title: "Projects",
  description: "Case studies of software projects: what was built, how, and with which technologies.",
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="site-container py-16 md:py-24">
      <ProjectGrid projects={projects} />
    </div>
  );
}
