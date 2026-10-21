import type { Metadata } from "next";
import { ArrowUpRight, Mail } from "lucide-react";
import { ContactForm } from "@/src/features/contact";
import { PageIntro } from "@/src/components/public/PageIntro";

export const runtime = "nodejs";
export const metadata: Metadata = { title: "Kontakt", alternates: { canonical: "/de/contact", languages: { en: "/contact", de: "/de/contact" } } };
export default function GermanContactPage() {
  return <div className="site-container py-16 md:py-24">
    <PageIntro section="Direkter Kontakt" title="Kontakt aufnehmen" description="Für Fragen oder Nachrichten zu Softwareprojekten können Sie dieses Formular oder die angegebene E-Mail-Adresse nutzen." />
    <div className="mt-12 grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="space-y-8 lg:col-span-5"><div className="space-y-4 border-t border-border/60 pt-6 font-mono text-xs text-muted-foreground">
        <div><span className="mb-1 block font-medium uppercase tracking-wider text-foreground/80">E-Mail</span><a href="mailto:ugur.oezdamar@itc-studenten.de" className="inline-flex items-center gap-1.5 text-foreground hover:underline"><Mail className="h-3.5 w-3.5" />ugur.oezdamar@itc-studenten.de</a></div>
        <div><span className="mb-1 block font-medium uppercase tracking-wider text-foreground/80">Standort</span><span>Dortmund, Deutschland</span></div>
        <div><span className="mb-1 block font-medium uppercase tracking-wider text-foreground/80">Profile</span><div className="flex items-center gap-4 pt-1"><a href="https://github.com/devUgur" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground hover:underline">GitHub <ArrowUpRight className="h-3 w-3" /></a></div></div>
      </div></div>
      <div className="lg:col-span-7"><div className="border-t border-border pt-6"><h2 className="mb-6 font-serif text-2xl font-medium text-foreground">Nachricht senden</h2><ContactForm locale="de" /></div></div>
    </div>
  </div>;
}
