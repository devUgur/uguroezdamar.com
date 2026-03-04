import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@ugur/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ugur Portal",
  description: "Admin portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
