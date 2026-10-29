import type { Metadata } from "next";

import "../globals.css";
import { ThemeProvider } from "@ugur/ui";
import { displayFont, monoFont, sansFont } from "../fonts";

const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://uguroezdamar.com";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalOrigin),
  title: {
    default: "Ugur Özdamar",
    template: "%s | Ugur Özdamar",
  },
  description:
    "Software Engineering · Digital Products. Full-stack development, scalable applications, and thoughtful engineering by Ugur Özdamar.",
  openGraph: {
    title: "Ugur Özdamar – Software Engineering · Digital Products",
    description:
      "Full-stack development, scalable applications, and thoughtful engineering by Ugur Özdamar.",
    url: canonicalOrigin,
    siteName: "Ugur Özdamar",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ugur Özdamar – Software Engineering · Digital Products",
    description:
      "Full-stack development, scalable applications, and thoughtful engineering by Ugur Özdamar.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
