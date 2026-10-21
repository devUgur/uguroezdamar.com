import type { Locale } from "@/src/features/navigation/copy";
import { PageIntro } from "./PageIntro";

const content = {
  en: {
    section: "Legal · draft for operator review",
    title: "Imprint",
    lede: "Provider information for this portfolio. The operator must confirm the missing details before this page is complete.",
    notice: "Provider address still required",
    noticeText: "The source repository contains no postal address. It must be supplied and reviewed by the operator before this page is treated as a complete legal disclosure.",
    provider: "Provider",
    name: "Ugur Özdamar",
    address: "Postal address: to be completed by the operator",
    contact: "Contact",
    email: "Email",
    conditions: "Additional information",
    conditionsText: "Whether register, VAT, professional or supervisory details apply depends on the operator's status and activity. Confirm applicability under section 5 DDG before release.",
    updated: "Last updated 21 October 2026. Technical draft; not legal advice.",
  },
  de: {
    section: "Rechtliches · Entwurf zur Betreiberprüfung",
    title: "Impressum",
    lede: "Anbieterangaben für dieses Portfolio. Die fehlenden Angaben muss der Betreiber vor Fertigstellung bestätigen.",
    notice: "Anschrift des Anbieters fehlt noch",
    noticeText: "Im Repository ist keine postalische Anschrift hinterlegt. Der Betreiber muss sie ergänzen und prüfen, bevor diese Seite als vollständige Anbieterkennzeichnung gelten kann.",
    provider: "Anbieter",
    name: "Ugur Özdamar",
    address: "Postanschrift: vom Betreiber zu ergänzen",
    contact: "Kontakt",
    email: "E-Mail",
    conditions: "Weitere Angaben",
    conditionsText: "Ob Register-, Umsatzsteuer-, Berufs- oder Aufsichtsangaben gelten, hängt vom Status und der Tätigkeit des Anbieters ab. Die Anwendbarkeit von § 5 DDG muss vor der Freigabe geprüft werden.",
    updated: "Zuletzt aktualisiert am 21. Oktober 2026. Technischer Entwurf; keine Rechtsberatung.",
  },
} as const;

export function ImprintNotice({ locale }: { locale: Locale }) {
  const text = content[locale];
  return (
    <article className="site-container py-12 md:py-20">
      <PageIntro section={text.section} title={text.title} description={text.lede} />
      <div className="mx-auto max-w-5xl">
        <aside className="mb-10 grid gap-3 border border-border bg-surface p-5 md:grid-cols-[minmax(12rem,1fr)_2fr] md:p-7">
          <h2 className="font-mono text-xs font-medium uppercase tracking-widest">{text.notice}</h2>
          <p className="text-sm leading-7 text-muted-foreground">{text.noticeText}</p>
        </aside>
        <div className="divide-y divide-border border-y border-border">
          <section className="grid gap-3 py-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-8 md:py-8">
            <h2 className="font-serif text-2xl">{text.provider}</h2>
            <address className="space-y-2 text-sm leading-7 not-italic text-muted-foreground">
              <p className="font-medium text-foreground">{text.name}</p>
              <p>{text.address}</p>
            </address>
          </section>
          <section className="grid gap-3 py-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-8 md:py-8">
            <h2 className="font-serif text-2xl">{text.contact}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{text.email}: <a href="mailto:ugur.oezdamar@itc-studenten.de" className="text-foreground underline underline-offset-4">ugur.oezdamar@itc-studenten.de</a></p>
          </section>
          <section className="grid gap-3 py-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-8 md:py-8">
            <h2 className="font-serif text-2xl">{text.conditions}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{text.conditionsText}</p>
          </section>
        </div>
        <p className="mt-7 text-xs leading-6 text-muted-foreground">{text.updated}</p>
      </div>
    </article>
  );
}
