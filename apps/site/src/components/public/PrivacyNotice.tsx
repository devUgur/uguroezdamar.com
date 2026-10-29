import type { Locale } from "@/src/features/navigation/copy";
import { PageIntro } from "./PageIntro";

const content = {
  en: {
    section: "Privacy · data processing",
    title: "Privacy notice",
    lede: "How this portfolio handles information when you visit the site, choose a theme, or contact the operator.",
    sections: [
      {
        title: "Controller and privacy contact",
        body: (
          <>
            The controller is Ugur Özdamar, Stockumer Straße 219, 44225 Dortmund, Germany. For privacy questions or requests, email <a href="mailto:privacy@viralsync.io">privacy@viralsync.io</a>. No data protection officer is appointed.
          </>
        ),
      },
      {
        title: "Website delivery and technical data",
        body: (
          <>
            The portfolio is hosted by Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA). Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, USA) manages DNS records; website entries are configured DNS-only so requests are served directly by Vercel. Providers process technical connection data (IP address, requested path, timestamp, and protocol headers) to resolve domains, deliver assets, protect infrastructure, and diagnose errors. The legal basis is Article 6(1)(f) GDPR (legitimate interest in secure, reliable portfolio operations). Vercel retains runtime logs for up to one hour. Neon, Inc. hosts the PostgreSQL database in the AWS region Frankfurt am Main, Germany (EU), with a point-in-time recovery window of up to six hours. Both Vercel Inc. and Cloudflare, Inc. are actively certified under the EU-U.S. Data Privacy Framework (DPF).
          </>
        ),
      },
      {
        title: "Contact form",
        body: (
          <>
            Submitting the contact form stores your name, email address, and message in the Neon PostgreSQL database located in Frankfurt am Main, Germany. The operator reviews and manages messages via a protected administrative portal. The form does not dispatch automated marketing or email relays. The provision of personal data is voluntary, but necessary to receive and reply to your enquiry. No automated decision-making or profiling takes place. Requests are scheduled for deletion 90 days after receipt, or 90 days after being marked as resolved. An automated daily production task deletes expired records. The legal basis is Article 6(1)(b) GDPR for pre-contractual inquiries or Article 6(1)(f) GDPR for other correspondence. Please do not submit confidential credentials or sensitive personal data.
          </>
        ),
      },
      {
        title: "Email enquiries",
        body: (
          <>
            If you send an email to <a href="mailto:ugur.oezdamar@itc-studenten.de">ugur.oezdamar@itc-studenten.de</a> or privacy requests to <a href="mailto:privacy@viralsync.io">privacy@viralsync.io</a>, your email address, message body, and attachments are processed to answer your request. Inquiries sent to <a href="mailto:privacy@viralsync.io">privacy@viralsync.io</a> are forwarded via Cloudflare Email Routing to a Google mailbox. Google LLC is actively certified under the EU-U.S. Data Privacy Framework. Standard consumer Gmail accounts do not provide a separate Art. 28 GDPR DPA (unlike Google Workspace); data processing relies on Google LLC&apos;s active DPF certification. Routine correspondence is deleted within 90 days of handling unless statutory retention obligations apply. The legal basis is Article 6(1)(b) GDPR or Article 6(1)(f) GDPR.
          </>
        ),
      },
      {
        title: "Anti-abuse and portal security",
        body: (
          <>
            For form abuse prevention and rate limiting, the server generates an HMAC pseudonym from the client IP supplied by Vercel and stores it with a short-lived counter (5 requests per 10 minutes); raw IP addresses are never persisted for rate limiting. Failed administrator logins record the client IP address in the database for 15 minutes to prevent brute-force attacks; records are purged after 24 hours. Administrator sessions and invitations are governed by strict lifetimes and purged by the daily cleanup routine.
          </>
        ),
      },
      {
        title: "Browser storage and third-party links",
        body: (
          <>
            Theme preferences (light, dark, or system) are saved exclusively in local browser storage (localStorage) upon selection. No tracking cookies or advertising technologies are loaded. External links (e.g. GitHub or live projects) open external services that operate under their own data protection policies.
          </>
        ),
      },
      {
        title: "Recipients, third-country transfers and your rights",
        body: (
          <>
            Data processing involves the following recipients:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Vercel Inc. (USA):</strong> Web hosting and edge CDN. Active participant in the EU-U.S. Data Privacy Framework; Standard Contractual Clauses (SCCs) in Vercel&apos;s DPA.</li>
              <li><strong>Cloudflare, Inc. (USA):</strong> Authoritative DNS and email forwarding. Active participant in the EU-U.S. Data Privacy Framework.</li>
              <li><strong>Google LLC (USA):</strong> Mailbox for incoming forwarded correspondence. Active participant in the EU-U.S. Data Privacy Framework.</li>
              <li><strong>Neon, Inc. (EU / Germany):</strong> Serverless database hosted in Frankfurt am Main, Germany.</li>
            </ul>
            <p className="mt-3">
              Where data is processed in the United States, transfers rely on the European Commission&apos;s adequacy decision for the EU-U.S. Data Privacy Framework (Article 45 GDPR) and supplementary standard contractual clauses where applicable. You have the right to request access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20), and to object to processing based on legitimate interests (Art. 21). You also have the right to lodge a complaint with a data protection authority, such as the <a href="https://www.ldi.nrw.de/beschwerde" target="_blank" rel="noopener noreferrer">Landesbeauftragte für Datenschutz und Informationsfreiheit NRW</a>.
            </p>
          </>
        ),
      },
    ],
    updated: "Last updated 29 October 2026.",
  },
  de: {
    section: "Datenschutz · Datenverarbeitung",
    title: "Datenschutzhinweise",
    lede: "So verarbeitet dieses Portfolio Informationen beim Besuch der Website, bei der Auswahl des Designs und bei einer Kontaktaufnahme.",
    sections: [
      {
        title: "Verantwortlicher und Datenschutzkontakt",
        body: (
          <>
            Verantwortlicher ist Ugur Özdamar, Stockumer Straße 219, 44225 Dortmund, Deutschland. Für Datenschutzfragen und Betroffenenanfragen: <a href="mailto:privacy@viralsync.io">privacy@viralsync.io</a>. Ein Datenschutzbeauftragter ist nicht bestellt.
          </>
        ),
      },
      {
        title: "Auslieferung der Website und technische Daten",
        body: (
          <>
            Das Portfolio wird bei Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) gehostet. Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, USA) verwaltet die DNS-Einträge; die Website-Einträge sind DNS-only konfiguriert, sodass Seitenaufrufe direkt von Vercel ausgeliefert werden. Beide Anbieter verarbeiten technische Verbindungsdaten (IP-Adresse, Pfad, Zeitstempel, HTTP-Header), um Anfragen aufzulösen, auszuliefern, die Plattform abzusichern und Störungen zu beheben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem stabilen und sicheren Betrieb). Vercel Runtime-Logs werden bis zu einer Stunde aufbewahrt. Die Datenbank wird von Neon, Inc. in der Region Frankfurt am Main (Deutschland, EU) betrieben. Vercel Inc. und Cloudflare, Inc. sind als aktive Teilnehmer unter dem EU-U.S. Data Privacy Framework (DPF) beim US-Handelsministerium zertifiziert.
          </>
        ),
      },
      {
        title: "Kontaktformular",
        body: (
          <>
            Wenn Sie das Formular absenden, speichert die Website Ihren Namen, Ihre E-Mail-Adresse und Ihre Nachricht in einer Neon-PostgreSQL-Datenbank in Frankfurt am Main. Der Betreiber kann Anfragen dort in einem geschützten Portal einsehen und bearbeiten. Das Formular versendet keine automatisierten E-Mails. Die Bereitstellung Ihrer personenbezogenen Daten ist freiwillig, jedoch erforderlich, um Ihre Anfrage zuzuordnen und zu beantworten. Es findet keine automatisierte Entscheidungsfindung oder Profiling statt. Eine Anfrage wird 90 Tage nach Eingang oder 90 Tage nach Erledigung zur Löschung vorgesehen und durch eine tägliche automatisierte Aufgabe physisch gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO für vorvertragliche Anfragen oder Art. 6 Abs. 1 lit. f DSGVO für allgemeine Anfragen. Bitte übermitteln Sie keine vertraulichen Passwörter oder sensiblen Daten.
          </>
        ),
      },
      {
        title: "Anfragen per E-Mail",
        body: (
          <>
            Wenn Sie an <a href="mailto:ugur.oezdamar@itc-studenten.de">ugur.oezdamar@itc-studenten.de</a> oder <a href="mailto:privacy@viralsync.io">privacy@viralsync.io</a> schreiben, werden Ihre E-Mail-Adresse, der Inhalt und eventuelle Anhänge zur Beantwortung verarbeitet. Anfragen an <a href="mailto:privacy@viralsync.io">privacy@viralsync.io</a> werden über Cloudflare Email Routing an ein Google-Postfach weitergeleitet. Google LLC ist aktiver Teilnehmer des EU-U.S. Data Privacy Framework. Für private Google-Konten besteht (im Gegensatz zu Google Workspace) kein gesonderter Art. 28 DSGVO Auftragsverarbeitungsvertrag; die Verarbeitung stützt sich auf die DPF-Zertifizierung von Google LLC. E-Mails werden spätestens 90 Tage nach Abschluss der Bearbeitung gelöscht, sofern keine gesetzlichen Aufbewahrungsfristen entgegenstehen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. f DSGVO.
          </>
        ),
      },
      {
        title: "Schutz vor Missbrauch und Portal-Sicherheit",
        body: (
          <>
            Für das Formular-Rate-Limit bildet der Server aus der übermittelten Client-Adresse ein HMAC-Pseudonym und speichert dieses mit einem kurzlebigen Zähler (maximal 5 Anfragen je 10 Minuten); die rohe IP-Adresse wird für das Rate-Limit nicht dauerhaft gespeichert. Fehlgeschlagene Administrator-Anmeldungen speichern die IP-Adresse für 15 Minuten zur Abwehr von Brute-Force-Angriffen (Löschung nach 24 Stunden). Administratoren-Sitzungen und Einladungen werden mit begrenzter Gültigkeit geführt und täglich bereinigt.
          </>
        ),
      },
      {
        title: "Browser-Speicher und externe Dienste",
        body: (
          <>
            Die Theme-Auswahl (hell, dunkel oder System) wird im lokalen Speicher des Browsers (localStorage) hinterlegt. Es werden keine Tracking-Cookies oder Werbetracker geladen. Externe Links (wie GitHub oder Projekt-Websites) leiten zu unabhängigen Plattformen weiter, für die deren jeweilige Datenschutzbestimmungen gelten.
          </>
        ),
      },
      {
        title: "Empfänger, Drittlandtransfers und Ihre Rechte",
        body: (
          <>
            An der Verarbeitung wirken folgende Dienstleister mit:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Vercel Inc. (USA):</strong> Hosting und Content Delivery. Aktiver Teilnehmer des EU-U.S. Data Privacy Framework; Standardvertragsklauseln (SCCs) im Vercel-DPA.</li>
              <li><strong>Cloudflare, Inc. (USA):</strong> Autoritatives DNS und E-Mail-Weiterleitung. Aktiver Teilnehmer des EU-U.S. Data Privacy Framework.</li>
              <li><strong>Google LLC (USA):</strong> Postfachempfang weitergeleiteter Datenschutzanfragen. Aktiver Teilnehmer des EU-U.S. Data Privacy Framework.</li>
              <li><strong>Neon, Inc. (EU / Deutschland):</strong> Serverlose PostgreSQL-Datenbank mit Standort in Frankfurt am Main.</li>
            </ul>
            <p className="mt-3">
              Soweit Daten in den USA verarbeitet werden, erfolgt die Übermittlung auf Grundlage des Angemessenheitsbeschlusses der Europäischen Kommission für das EU-U.S. Data Privacy Framework (Art. 45 DSGVO) sowie gegebenenfalls ergänzender Standardvertragsklauseln. Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Sie haben zudem das Recht auf Beschwerde bei einer Aufsichtsbehörde, beispielsweise der <a href="https://www.ldi.nrw.de/beschwerde" target="_blank" rel="noopener noreferrer">Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen</a>.
            </p>
          </>
        ),
      },
    ],
    updated: "Zuletzt aktualisiert am 29. Oktober 2026.",
  },
} as const;

export function PrivacyNotice({ locale }: { locale: Locale }) {
  const text = content[locale];
  return (
    <article className="site-container py-12 md:py-20">
      <PageIntro section={text.section} title={text.title} description={text.lede} />
      <div className="mx-auto max-w-5xl">
        <div className="divide-y divide-border border-y border-border">
          {text.sections.map((item, index) => (
            <section key={item.title} className="grid gap-3 py-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-8 md:py-8">
              <h2 className="font-serif text-xl leading-snug md:text-2xl">
                <span className="mr-3 font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                {item.title}
              </h2>
              <div className="article-prose text-sm leading-7">{item.body}</div>
            </section>
          ))}
        </div>
        <p className="mt-7 text-xs leading-6 text-muted-foreground">{text.updated}</p>
      </div>
    </article>
  );
}

export default PrivacyNotice;
