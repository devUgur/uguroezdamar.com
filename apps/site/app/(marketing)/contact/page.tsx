import { ContactForm } from "@/src/features/contact";
import { Container, Section } from "@ugur/ui";

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
