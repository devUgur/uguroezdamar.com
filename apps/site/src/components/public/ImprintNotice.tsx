import type { Locale } from "@/src/features/navigation/copy";
import { PageIntro } from "./PageIntro";

const content = {
  en: {
    section: "Legal · provider information",
    title: "Imprint",
    lede: "Provider and contact information for this portfolio website.",
    notice: "Final legal status review remains open",
    noticeText: "The operator identity and postal address were confirmed for reuse from the ViralSync legal records on 22 October 2026. The applicability of the statutory disclosure requirements and any activity-specific details still require review. This page remains a technical draft until that review is complete.",
    provider: "Provider",
    name: "Ugur Özdamar",
    address: "Stockumer Straße 219, 44225 Dortmund, Germany",
    contact: "Contact",
    legalEmail: "Legal enquiries",
    phone: "Telephone",
    conditions: "Additional information",
    conditionsText: "This page identifies the operator as a natural person and does not claim a registered company, commercial register entry or professional licence. Whether further occupational or supervisory details must be disclosed depends on the operator's activity and requires final review.",
    updated: "Last updated 22 October 2026. Technical draft pending legal review.",
  },
  de: {
    section: "Rechtliches · Anbieterangaben",
    title: "Impressum",
    lede: "Anbieter- und Kontaktangaben für diese Portfolio-Website.",
    notice: "Abschließende Prüfung des Rechtsstatus steht noch aus",
    noticeText: "Betreiberidentität und Postanschrift wurden am 22. Oktober 2026 zur Übernahme aus den ViralSync-Rechtsangaben bestätigt. Die Anwendbarkeit der gesetzlichen Informationspflichten und mögliche tätigkeitsbezogene Zusatzangaben müssen noch geprüft werden. Bis zum Abschluss dieser Prüfung bleibt diese Seite ein technischer Entwurf.",
    provider: "Anbieter",
    name: "Ugur Özdamar",
    address: "Stockumer Straße 219, 44225 Dortmund, Deutschland",
    contact: "Kontakt",
    legalEmail: "Rechtliche Anfragen",
    phone: "Telefon",
    conditions: "Weitere Angaben",
    conditionsText: "Als Anbieter wird eine natürliche Person genannt; eine eingetragene Gesellschaft, ein Handelsregistereintrag oder eine Berufszulassung wird nicht behauptet. Ob abhängig von der Tätigkeit weitere berufliche oder aufsichtsrechtliche Angaben erforderlich sind, muss abschließend geprüft werden.",
    updated: "Zuletzt aktualisiert am 22. Oktober 2026. Technischer Entwurf; Rechtsprüfung steht noch aus.",
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
            <div className="space-y-1 text-sm leading-7 text-muted-foreground">
              <p>{text.legalEmail}: <a href="mailto:legal@viralsync.io" className="text-foreground underline underline-offset-4">legal@viralsync.io</a></p>
              <p>{text.phone}: <a href="tel:+4915126546603" className="text-foreground underline underline-offset-4">+49 151 26546603</a></p>
            </div>
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
