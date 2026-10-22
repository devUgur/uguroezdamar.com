import type { Locale } from "@/src/features/navigation/copy";
import { PageIntro } from "./PageIntro";

const content = {
  en: {
    section: "Legal · provider information",
    title: "Imprint",
    lede: "Provider and contact information for this portfolio website.",
    provider: "Provider",
    name: "Ugur Özdamar",
    address: "Stockumer Straße 219, 44225 Dortmund, Germany",
    contact: "Contact",
    legalEmail: "Legal enquiries",
    phone: "Telephone",
    conditions: "Additional information",
    conditionsText: "The provider is identified as a natural person. No company or commercial register entry is stated.",
    updated: "Last updated 22 October 2026.",
  },
  de: {
    section: "Rechtliches · Anbieterangaben",
    title: "Impressum",
    lede: "Anbieter- und Kontaktangaben für diese Portfolio-Website.",
    provider: "Anbieter",
    name: "Ugur Özdamar",
    address: "Stockumer Straße 219, 44225 Dortmund, Deutschland",
    contact: "Kontakt",
    legalEmail: "Rechtliche Anfragen",
    phone: "Telefon",
    conditions: "Weitere Angaben",
    conditionsText: "Der Anbieter wird als natürliche Person genannt. Eine Gesellschaft oder ein Handelsregistereintrag wird nicht angegeben.",
    updated: "Zuletzt aktualisiert am 22. Oktober 2026.",
  },
} as const;

export function ImprintNotice({ locale }: { locale: Locale }) {
  const text = content[locale];
  return (
    <article className="site-container py-12 md:py-20">
      <PageIntro section={text.section} title={text.title} description={text.lede} />
      <div className="mx-auto max-w-5xl">
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
