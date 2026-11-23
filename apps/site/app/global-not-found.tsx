import type { Metadata } from "next";

import "./globals.css";
import { displayFont, monoFont, sansFont } from "./fonts";
import GlobalNotFoundDocument from "./global-not-found-document";

export const metadata: Metadata = {
  title: { default: "Page not found | Ugur Özdamar", template: "%s | Ugur Özdamar" },
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return <GlobalNotFoundDocument fontClassName={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable}`} />;
}
