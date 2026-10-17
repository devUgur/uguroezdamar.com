import type { Metadata } from "next";
import localFont from "next/font/local";

// The font files ship with the existing @fontsource packages. next/font/local
// emits early preload hints and metric-adjusted fallbacks without third-party requests.
// "optional" avoids a late font swap when a first-time visitor has a slow connection.
const inter = localFont({
  src: "../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
  variable: "--font-inter",
  display: "optional",
  preload: true,
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

const playfair = localFont({
  src: "../node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2",
  variable: "--font-playfair",
  display: "optional",
  preload: true,
  fallback: ["Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
});

const jetbrainsMono = localFont({
  src: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
  variable: "--font-jetbrains-mono",
  display: "optional",
  preload: false,
  fallback: ["Courier New", "monospace"],
  adjustFontFallback: false,
});

import "./globals.css";
import { ThemeProvider } from "@ugur/ui";

export const metadata: Metadata = {
  title: {
    default: "Ugur Özdamar",
    template: "%s | Ugur Özdamar",
  },
  description:
    "Software Engineering · Digital Products. Full-stack development, scalable applications, and thoughtful engineering by Ugur Özdamar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
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
