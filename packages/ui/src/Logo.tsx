import React from "react";
import Link from "next/link";

export function Logo({ compact = false, size = 36 }: { compact?: boolean; size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className="text-primary group-hover:text-accent transition-colors duration-300">
        <rect width="100" height="100" fill="currentColor" rx="16" />
        <path d="M 26 24 L 26 52 C 26 66 34 72 43 72 C 52 72 60 66 60 52 L 60 30"
          fill="none" stroke="var(--color-primary-foreground)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 74 76 L 74 48 C 74 34 66 28 57 28 C 48 28 40 34 40 48 L 40 70"
          fill="none" stroke="var(--color-primary-foreground)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span
          className="font-serif text-lg tracking-tight group-hover:text-accent transition-colors duration-300"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Ugur Özdamar
        </span>
      )}
    </Link>
  );
}

export default Logo;
