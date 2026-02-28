import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export default function AboutPage() {
  return (
    <Container>
      <Section title="About" description="A short bio.">
        <p className="text-sm text-zinc-700">
          Replace this with your personal introduction.
        </p>
      </Section>
    </Container>
  );
}
