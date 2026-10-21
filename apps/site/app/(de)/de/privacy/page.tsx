import type { Metadata } from "next";
import { PageIntro } from "@/src/components/public/PageIntro";
export const metadata: Metadata = { title: "Datenschutz", alternates: { canonical: "/de/privacy", languages: { en: "/privacy", de: "/de/privacy" } } };
export default function GermanPrivacyPage() { return <article className="site-container py-16 md:py-24"><PageIntro section="Rechtliches" title="Datenschutz" description="Datenschutzhinweise." /><div className="mt-12 max-w-3xl border-t border-border pt-6 text-sm leading-7 text-muted-foreground"><p>Die vollständigen Datenschutzhinweise müssen vor einer rechtlich vollständigen Veröffentlichung noch ergänzt und geprüft werden.</p></div></article>; }
