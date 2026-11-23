import type { Metadata } from "next";

import { About } from "@/src/features/marketing/About";
import { PageIntro } from "@/src/components/public/PageIntro";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about", languages: { en: "/about", de: "/de/about" } } };

export default function AboutPage() {
  return <><div className="site-container pt-16 md:pt-24"><PageIntro section="Profile" title="About" /></div><About /></>;
}
