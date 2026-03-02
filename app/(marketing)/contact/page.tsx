import { ContactForm } from "@/features/contact";
import { Container } from "@/shared/ui/Container";
import { Section } from "@/shared/ui/Section";

export const runtime = "nodejs";

export default function ContactPage() {
  return (
    <Container>
      <Section title="Contact" description="Send me a message.">
        <ContactForm />
      </Section>
    </Container>
  );
}
