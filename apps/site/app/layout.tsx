import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "@ugur/ui";

export const metadata: Metadata = {
  title: {
    default: "Ugur Özdamar",
    template: "%s | Ugur Özdamar",
  },
  description: "Personal website and portfolio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
