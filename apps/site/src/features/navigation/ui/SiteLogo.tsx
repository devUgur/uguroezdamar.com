import Link from "next/link";

export function SiteLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-sm"
      aria-label="Ugur Özdamar — Homepage"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-surface font-serif text-sm font-bold tracking-tight text-foreground transition-all duration-300 group-hover:border-foreground/40 group-hover:bg-foreground group-hover:text-background">
        UÖ
      </span>
      {!compact && (
        <span className="font-serif text-lg tracking-tight text-foreground transition-colors duration-300 group-hover:text-foreground/80">
          Ugur Özdamar
        </span>
      )}
    </Link>
  );
}

export default SiteLogo;
