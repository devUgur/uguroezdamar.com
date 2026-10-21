import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function SiteLogo({ compact = false, size = 36, locale = "en" }: { compact?: boolean; size?: number; locale?: "en" | "de" }) {
  return (
    <Link
      href={locale === "de" ? "/de" : "/"}
      className="group inline-flex min-h-11 items-center gap-3 rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      aria-label={`Ugur Özdamar — ${locale === "de" ? "Startseite" : "Homepage"}`}
    >
      <BrandMark size={size} className="shrink-0" />
      {!compact && (
        <span className="font-serif text-lg tracking-tight transition-colors duration-300 group-hover:text-accent">
          Ugur Özdamar
        </span>
      )}
    </Link>
  );
}

export default SiteLogo;
