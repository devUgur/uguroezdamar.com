import type { Metadata } from "next";
import { About } from "@/src/features/marketing/About";
import { PageIntro } from "@/src/components/public/PageIntro";

export const metadata: Metadata = { title: "Über mich", alternates: { canonical: "/de/about", languages: { en: "/about", de: "/de/about" } } };
export default function GermanAboutPage() { return <><div className="site-container pt-16 md:pt-24"><PageIntro section="Profil" title="Über mich" /></div><About locale="de" /></>; }
