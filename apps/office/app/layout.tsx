import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider, Toaster } from "@ugur/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Office", template: "%s · Office" },
  description: "Das Büro der Agenten: Bereiche, Mitarbeiter und Gespräche.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
