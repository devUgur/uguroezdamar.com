import Link from "next/link";
import type { Locale } from "@/src/features/navigation/copy";
import { PageIntro } from "./PageIntro";

const content = {
  en: {
    section: "Legal · draft for operator review",
    title: "Privacy notice",
    lede: "A transparent account of the data flows currently implemented on this portfolio. Some operator and provider facts still require confirmation before this notice can be treated as complete.",
    review: "Operator confirmation required before unrestricted production release",
    reviewText: "The responsible controller's postal address, the legal basis for each contact scenario, provider contract and transfer details, and retention of hosting logs and backups have not yet been verified. See the internal release checklist before treating this notice as final.",
    sections: [
      { title: "Controller and contact", body: <>The site is operated by Ugur Özdamar. For privacy requests, use <a href="mailto:ugur.oezdamar@itc-studenten.de">ugur.oezdamar@itc-studenten.de</a>. The postal address required for the final provider information has not yet been entered. The site is not represented as having a data protection officer; whether one must be appointed remains for the operator to confirm.</> },
      { title: "Site operation and technical logs", body: <>The site is hosted on Vercel. Cloudflare is configured for DNS management; the portfolio's hosting decision specifies DNS-only routing. Hosting infrastructure processes connection and request data to deliver and secure the site. The exact log fields, retention periods, subprocessors, processing locations and contractual safeguards must be confirmed in the operator's provider accounts and agreements.</> },
      { title: "Contact form", body: <>If you submit the form, the site stores your name, email address and message in Neon PostgreSQL so the request can be reviewed in the protected portal. The form does not send an email. The fields are limited to 120 characters for a name, 320 for an email address and 5,000 for a message. Requests expire 90 days after receipt; when the operator marks a request as processed, its deletion deadline is extended to 90 days after that action. A daily production task deletes expired records, so a job outage may delay removal. The operator can also delete a request earlier in the portal. The legal basis for a specific request depends on its context and is still subject to operator confirmation before this notice is final.</> },
      { title: "Email inquiries", body: <>If you email the published address directly, your email address and message are processed by the sender's and recipient's email providers and stored in the recipient mailbox. The mailbox provider, its processing locations and the retention/deletion routine have not yet been confirmed by the operator.</> },
      { title: "Anti-abuse rate limit", body: <>To prevent abusive form submissions, the server uses the client address supplied by Vercel to create an HMAC pseudonym. It stores that pseudonym and a short-lived request counter, not the raw client address in the rate-limit table. A bucket is limited to five requests per ten minutes and expires after about 70 minutes; cleanup runs when a later request is counted. Provider access logs may separately process connection data; their retention remains to be verified.</> },
      { title: "Browser storage, analytics and external links", body: <>The theme control can store your light, dark or system preference in browser local storage. No analytics or advertising tracker is present in the site source reviewed for this release. A final check of actual production network requests and browser storage is still required. Project and profile links may lead to external services; those services process data under their own notices after you follow a link.</> },
      { title: "Recipients, transfers and backups", body: <>Vercel provides hosting and Neon provides the PostgreSQL database used by the contact flow. The exact contractual roles, subprocessors, processing locations, international transfer safeguards and backup retention have not yet been confirmed. Those details must be verified from the accounts and contracts before this notice is considered complete. Deleted records may remain in a provider backup until that backup expires.</> },
      { title: "Your rights", body: <>Subject to the conditions in data protection law, you may request access, rectification, erasure or restriction, object to processing where applicable, and lodge a complaint with the competent supervisory authority. Contact the operator by email above. The competent authority depends on the controller's establishment and your circumstances; it will be identified in the final notice.</> },
    ],
    updated: "Last updated 21 October 2026. Technical draft; not legal advice.",
    contactLink: "Contact page",
  },
  de: {
    section: "Rechtliches · Entwurf zur Betreiberprüfung",
    title: "Datenschutzhinweise",
    lede: "Diese Hinweise beschreiben transparent die derzeit im Portfolio umgesetzten Datenflüsse. Einige Angaben zum Betreiber und zu den Anbietern müssen noch bestätigt werden, bevor der Text als vollständig gelten kann.",
    review: "Betreiberbestätigung vor uneingeschränktem Produktionsbetrieb erforderlich",
    reviewText: "Die ladungsfähige Anschrift des Verantwortlichen, die Rechtsgrundlage je Kontaktfall, Vertrags- und Transferangaben der Anbieter sowie Speicherfristen für Hosting-Logs und Backups sind noch nicht verifiziert. Die interne Freigabeliste muss vor der endgültigen Verwendung abgearbeitet werden.",
    sections: [
      { title: "Verantwortlicher und Kontakt", body: <>Betreiber der Website ist Ugur Özdamar. Für Datenschutzanfragen: <a href="mailto:ugur.oezdamar@itc-studenten.de">ugur.oezdamar@itc-studenten.de</a>. Die für die endgültigen Anbieterinformationen erforderliche ladungsfähige Anschrift ist noch nicht eingetragen. Ein Datenschutzbeauftragter wird hier nicht behauptet; ob eine Benennung erforderlich ist, muss der Betreiber bestätigen.</> },
      { title: "Betrieb der Website und technische Protokolle", body: <>Die Website wird bei Vercel gehostet. Cloudflare verwaltet die DNS-Einträge; laut Hosting-Entscheidung wird der Webverkehr nicht über einen Cloudflare-Proxy geleitet. Die Hosting-Infrastruktur verarbeitet Verbindungs- und Anfragedaten, um die Website auszuliefern und abzusichern. Konkrete Logfelder, Speicherfristen, Unterauftragsverarbeiter, Verarbeitungsorte und vertragliche Garantien müssen in den Betreiberkonten und Verträgen geprüft werden.</> },
      { title: "Kontaktformular", body: <>Beim Absenden werden Name, E-Mail-Adresse und Nachricht in Neon PostgreSQL gespeichert, damit die Anfrage im geschützten Portal geprüft und bearbeitet werden kann. Das Formular versendet keine E-Mail. Die Eingaben sind auf 120 Zeichen für den Namen, 320 Zeichen für die E-Mail-Adresse und 5.000 Zeichen für die Nachricht begrenzt. Anfragen laufen 90 Tage nach Eingang ab. Markiert der Betreiber eine Anfrage als bearbeitet, verlängert sich die Löschfrist bis 90 Tage nach dieser Handlung. Eine tägliche Aufgabe löscht abgelaufene Datensätze; ein Ausfall kann die Löschung verzögern. Der Betreiber kann eine Anfrage im Portal früher löschen. Die Rechtsgrundlage für den konkreten Anfragefall muss der Betreiber vor Freigabe bestätigen.</> },
      { title: "Anfragen per E-Mail", body: <>Wenn Sie die angegebene E-Mail-Adresse direkt anschreiben, verarbeiten die E-Mail-Anbieter von Absender und Empfänger Ihre E-Mail-Adresse und den Nachrichteninhalt. Die Nachricht wird im empfangenden Postfach gespeichert. Mailanbieter, Verarbeitungsorte und Löschfristen hat der Betreiber noch nicht bestätigt.</> },
      { title: "Schutz vor missbräuchlichen Anfragen", body: <>Zur Begrenzung von Spam verwendet der Server die von Vercel bereitgestellte Client-Adresse, um ein HMAC-Pseudonym zu bilden. In der Rate-Limit-Tabelle werden dieses Pseudonym und ein kurzlebiger Zähler gespeichert, nicht die rohe Client-Adresse. Pro Zehn-Minuten-Zeitfenster sind fünf Anfragen möglich; ein Schlüssel läuft nach etwa 70 Minuten ab und wird bei einer späteren Zählung bereinigt. Anbieter können Verbindungsdaten zusätzlich in eigenen Zugriffsprotokollen verarbeiten; deren Fristen sind noch zu prüfen.</> },
      { title: "Browser-Speicher, Analyse und externe Links", body: <>Die Darstellungsauswahl kann die Einstellung hell, dunkel oder System im lokalen Browser-Speicher sichern. Im für diesen Release geprüften Site-Quellcode ist kein Analyse- oder Werbetracker vorhanden. Vor der endgültigen Freigabe ist zusätzlich der tatsächliche Netzwerkverkehr der Production zu prüfen. Projekt- und Profil-Links können zu externen Diensten führen; nach dem Aufruf gelten deren eigene Datenschutzhinweise.</> },
      { title: "Empfänger, Drittlandtransfers und Backups", body: <>Vercel stellt das Hosting bereit; Neon stellt die PostgreSQL-Datenbank für den Kontaktablauf bereit. Die konkreten Vertragsrollen, Unterauftragsverarbeiter, Verarbeitungsorte, Garantien für internationale Übermittlungen und Backup-Fristen sind noch nicht bestätigt. Diese Angaben müssen vor der endgültigen Freigabe aus den Konten und Verträgen übernommen werden. Gelöschte Datensätze können bis zum Ablauf eines Anbieter-Backups darin verbleiben.</> },
      { title: "Ihre Rechte", body: <>Im Rahmen der gesetzlichen Voraussetzungen können Sie Auskunft, Berichtigung, Löschung oder Einschränkung verlangen, einer Verarbeitung gegebenenfalls widersprechen und sich bei der zuständigen Datenschutzaufsichtsbehörde beschweren. Kontaktieren Sie den Betreiber unter der oben genannten E-Mail-Adresse. Welche Aufsichtsbehörde zuständig ist, hängt vom Sitz des Verantwortlichen und den Umständen ab und wird in der endgültigen Fassung benannt.</> },
    ],
    updated: "Zuletzt aktualisiert am 21. Oktober 2026. Technischer Entwurf; keine Rechtsberatung.",
    contactLink: "Kontaktseite",
  },
} as const;

export function PrivacyNotice({ locale }: { locale: Locale }) {
  const text = content[locale];
  return (
    <article className="site-container py-12 md:py-20">
      <PageIntro section={text.section} title={text.title} description={text.lede} />
      <div className="mx-auto max-w-5xl">
        <aside className="mb-10 grid gap-3 border border-border bg-surface p-5 md:grid-cols-[minmax(12rem,1fr)_2fr] md:p-7" aria-labelledby="privacy-review-title">
          <h2 id="privacy-review-title" className="font-mono text-xs font-medium uppercase tracking-widest">{text.review}</h2>
          <p className="text-sm leading-7 text-muted-foreground">{text.reviewText} <Link href={locale === "de" ? "/de/contact" : "/contact"} className="text-foreground underline underline-offset-4">{text.contactLink}</Link>.</p>
        </aside>
        <div className="divide-y divide-border border-y border-border">
          {text.sections.map((item, index) => (
            <section key={item.title} className="grid gap-3 py-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-8 md:py-8">
              <h2 className="font-serif text-xl leading-snug md:text-2xl"><span className="mr-3 font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>{item.title}</h2>
              <div className="article-prose text-sm leading-7">{item.body}</div>
            </section>
          ))}
        </div>
        <p className="mt-7 text-xs leading-6 text-muted-foreground">{text.updated}</p>
      </div>
    </article>
  );
}
