import Link from "next/link";
import { type Locale } from "@/src/features/navigation/copy";

export function Contact({ number, locale = "en" }: { number: string; locale?: Locale }) {
  const de = locale === "de";
  return (
    <section id="contact" aria-labelledby="contact-heading" className="site-section pb-24 md:pb-32">
      <div className="site-container grid grid-cols-1 items-end gap-8 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-8">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground md:text-sm">
          {number} <span className="mx-2 text-border">/</span> {de ? "Kontakt" : "Contact"}
          </p>
          <h2 id="contact-heading" className="max-w-4xl text-4xl leading-[1.05] tracking-[-0.04em] md:text-6xl lg:text-7xl">
            {de ? "Lassen Sie uns ins Gespräch kommen." : "Start a conversation."}
          </h2>
        </div>
        <div className="contact-panel border border-border bg-surface p-5 md:col-span-3 md:col-start-10 md:p-7">
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            {de ? "Für Fragen oder Nachrichten zu Softwareprojekten nutzen Sie bitte die Kontaktseite." : "For a question or a message about software work, use the contact page."}
          </p>
          <Link href={de ? "/de/contact" : "/contact"} className="link-underline mt-5 inline-flex min-h-11 items-center gap-3 font-mono text-xs uppercase tracking-[0.13em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            {de ? "Kontakt aufnehmen" : "Go to contact"} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Contact;
