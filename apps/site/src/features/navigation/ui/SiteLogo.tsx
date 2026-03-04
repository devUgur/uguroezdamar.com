import Link from "next/link";

export function SiteLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3 group" aria-label="Go to homepage">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background font-serif text-base font-bold tracking-tight">
        UÖ
      </span>
      {!compact && (
        <span className="font-serif text-lg tracking-tight text-foreground group-hover:text-accent transition-colors">
          Ugur Özdamar
        </span>
      )}
    </Link>
  );
}
