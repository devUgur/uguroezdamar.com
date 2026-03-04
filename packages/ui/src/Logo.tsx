import React from "react";
import Link from "next/link";

export function Logo({ compact = false, size = 36 }: { compact?: boolean; size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      <img
        src="/icon.svg"
        alt="Ugur Özdamar"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain transition-opacity duration-200"
      />
      {!compact && (
        <span
          className="font-serif text-lg tracking-tight group-hover:text-accent transition-colors duration-300 text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Ugur Özdamar
        </span>
      )}
    </Link>
  );
}

export default Logo;
