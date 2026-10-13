export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-background py-10 transition-colors duration-300">
      <div className="flex flex-col items-center justify-between px-6 md:flex-row md:px-12 lg:px-24">
        <span className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-300 hover:text-foreground md:text-left md:text-sm">
          © {new Date().getFullYear()} Ugur Özdamar — All Rights Reserved
        </span>
      </div>
    </footer>
  );
}
