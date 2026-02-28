import { getAllProjects, ProjectGrid } from "@/features/projects";
import { Container } from "@/shared/ui/Container";

export default async function ProjectsPage() {
  const projects = await getAllProjects();

  return (
    <Container>
      <ProjectGrid projects={projects} />
    </Container>
  );
}
