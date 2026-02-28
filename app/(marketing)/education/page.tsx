import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export default function EducationPage() {
  return (
    <Container>
      <Section title="Education" description="Courses and degrees.">
        <p className="text-sm text-zinc-700">Add your education here.</p>
      </Section>
    </Container>
  );
}
