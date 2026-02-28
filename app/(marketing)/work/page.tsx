import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export default function WorkPage() {
  return (
    <Container>
      <Section title="Work" description="Experience timeline.">
        <p className="text-sm text-zinc-700">Add your experience here.</p>
      </Section>
    </Container>
  );
}
