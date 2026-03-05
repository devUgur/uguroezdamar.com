import { ProjectGrid } from "@/src/features/projects";
import { getSiteProjects } from "@/src/adapters/projects";
import { Container } from "@ugur/ui";

export default async function ProjectsPage() {
  const projects = await getSiteProjects();

  return (
    <Container>
      <ProjectGrid projects={projects} />
    </Container>
  );
}
