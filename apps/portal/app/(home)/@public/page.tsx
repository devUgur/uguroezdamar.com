import Link from "next/link";
import { Button, Container, Section } from "@ugur/ui";

export default function PublicPage() {
  return (
    <Container>
      <Section title="" className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Welcome to Ugur's Portal
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          The central hub for managing projects, timeline items, and more.
        </p>
        <div className="flex gap-4">
          <Button asChild variant="primary">
            <Link href="/login">Login to Portal</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </Section>
    </Container>
  );
}
