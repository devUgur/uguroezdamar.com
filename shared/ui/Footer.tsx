import { Container } from "@/shared/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-10 mt-auto">
      <Container className="flex items-center justify-center">
        <span className="font-mono text-xs md:text-sm tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors duration-300">
          © {new Date().getFullYear()} Ugur Özdamar — All Rights Reserved
        </span>
      </Container>
    </footer>
  );
}
