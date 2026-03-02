import type { Metadata } from "next";

import "./globals.css";
import { Header } from "@/shared/ui/Header";
import { Footer } from "@/shared/ui/Footer";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import { ScrollProgress } from "@/shared/ui/ScrollProgress";

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
          <ScrollProgress />
          <Header />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
