import type { Metadata } from "next";

import "../globals.css";
import { ThemeProvider } from "@ugur/ui";
import { displayFont, monoFont, sansFont } from "../fonts";

const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://uguroezdamar.com";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalOrigin),
  title: { default: "Ugur Özdamar", template: "%s | Ugur Özdamar" },
  description: "Softwareentwicklung · Digitale Produkte. Full-Stack-Entwicklung, skalierbare Anwendungen und durchdachte technische Lösungen von Ugur Özdamar.",
  openGraph: {
    title: "Ugur Özdamar – Softwareentwicklung · Digitale Produkte",
    description: "Full-Stack-Entwicklung, skalierbare Anwendungen und durchdachte technische Lösungen von Ugur Özdamar.",
    url: `${canonicalOrigin}/de`,
    siteName: "Ugur Özdamar",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: "/og-image-de.png",
        width: 1200,
        height: 630,
        alt: "Ugur Özdamar – Softwareentwicklung · Digitale Produkte",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ugur Özdamar – Softwareentwicklung · Digitale Produkte",
    description: "Full-Stack-Entwicklung, skalierbare Anwendungen und durchdachte technische Lösungen von Ugur Özdamar.",
    images: ["/og-image-de.png"],
  },
};

export default function GermanRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
