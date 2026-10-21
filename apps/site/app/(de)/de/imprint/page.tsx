import type { Metadata } from "next";
import { PageIntro } from "@/src/components/public/PageIntro";
export const metadata: Metadata = { title: "Impressum", alternates: { canonical: "/de/imprint", languages: { en: "/imprint", de: "/de/imprint" } } };
export default function GermanImprintPage() { return <article className="site-container py-16 md:py-24"><PageIntro section="Rechtliches" title="Impressum" description="Angaben zum Anbieter." /><div className="mt-12 max-w-3xl border-t border-border pt-6 text-sm leading-7 text-muted-foreground"><p>Die vollständigen Anbieterangaben müssen vor einer rechtlich vollständigen Veröffentlichung noch ergänzt und geprüft werden.</p></div></article>; }
