import type { Metadata } from "next";
import { Education } from "@/src/features/marketing/Education";
import { PageIntro } from "@/src/components/public/PageIntro";

export const metadata: Metadata = { title: "Ausbildung", alternates: { canonical: "/de/education", languages: { en: "/education", de: "/de/education" } } };
export default function GermanEducationPage() { return <><div className="site-container pt-16 md:pt-24"><PageIntro section="Werdegang" title="Ausbildung" /></div><Education locale="de" /></>; }
