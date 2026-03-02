export function Footer() {
  return (
    <footer className="border-t border-border/40 py-10 mt-auto bg-background transition-colors duration-300">
      <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-12 lg:px-24">
        <span className="font-mono text-xs md:text-sm tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors duration-300 text-center md:text-left">
          © {new Date().getFullYear()} Ugur Özdamar — All Rights Reserved
        </span>
      </div>
    </footer>
  );
}
