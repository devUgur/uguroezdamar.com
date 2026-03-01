import type { Metadata } from "next";

import "./globals.css";
import { Header } from "@/shared/ui/Header";
import { Footer } from "@/shared/ui/Footer";

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
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
