export type Locale = "en" | "de";

export function getLocale(pathname: string | null): Locale {
  return pathname === "/de" || pathname?.startsWith("/de/") ? "de" : "en";
}

export function localizedPath(pathname: string, locale: Locale): string {
  const unprefixed = pathname === "/de" ? "/" : pathname.startsWith("/de/") ? pathname.slice(3) : pathname;
  if (locale === "de" && unprefixed.startsWith("/blog/")) return "/de/blog";
  if (locale === "en" && unprefixed.startsWith("/blog/")) return unprefixed;
  return locale === "de" ? (unprefixed === "/" ? "/de" : `/de${unprefixed}`) : unprefixed;
}

export const copy = {
  en: {
    nav: ["Projects", "About", "Contact"], skip: "Skip to main content", mainNav: "Main navigation", footerNav: "Footer navigation", themeToggle: "Toggle theme",
    contact: "Contact", imprint: "Imprint", privacy: "Privacy", openMenu: "Open navigation menu", closeMenu: "Close navigation menu",
    project: "Project catalog", projects: "Projects", projectDescription: "Case studies of software I have built: the problem, the solution and the architecture behind it.",
    noProjects: "No projects have been published yet.", caseStudy: "View case study", draft: "Draft", technologies: "Technologies",
    role: "Role", period: "Period", status: "Status", active: "In development", completed: "Completed", archived: "Archived", whatIDid: "What I did",
    blogSection: "Writing & notes", blogTitle: "Engineering articles", blogDescription: "Thoughts on full-stack architecture, distributed systems, type safety, and real-world production engineering.", noArticles: "No articles published yet.", readArticle: "Read article", writing: "Writing",
    aboutSection: "Profile", aboutTitle: "About", educationSection: "Background", educationTitle: "Education", directContact: "Direct contact", getInTouch: "Get in touch",
    contactDescription: "For a question or a message about software work, send a message here or use the listed email address.", email: "Direct email", location: "Location", profiles: "Profiles", sendMessage: "Send a message", name: "Name", message: "Message", sending: "Sending…", sent: "Your request has been saved.", sendError: "Failed to save request", contactPrivacyNote: "Your name, email address and message are stored so the request can be reviewed. This form does not send an email. Read the privacy notice.", contactPrivacyLink: "privacy notice", contactNameHint: "Enter a name (up to 120 characters).", contactEmailHint: "Use an email address where you can be reached.", contactMessageHint: "Write your message (up to 5,000 characters).",
    notFound: "Page not found", notFoundDescription: "The page you are looking for does not exist.", goHome: "Go home", retry: "Retry", errorTitle: "Something went wrong", tryAgain: "Please try again.",
    projectLinks: "Project links", educationLabel: "Education", profileLabel: "Profile", career: "Career experience", home: "Home", language: "Language", switchLanguage: "Deutsch",
    emptyProfile: "Profile details have not been published yet.", emptyEducation: "No education entries have been published yet.",
  },
  de: {
    nav: ["Projekte", "Profil", "Kontakt"], skip: "Zum Hauptinhalt springen", mainNav: "Hauptnavigation", footerNav: "Fußnavigation", themeToggle: "Darstellung wechseln",
    contact: "Kontakt", imprint: "Impressum", privacy: "Datenschutz", openMenu: "Navigationsmenü öffnen", closeMenu: "Navigationsmenü schließen",
    project: "Projektübersicht", projects: "Projekte", projectDescription: "Ausgewählte Softwareprojekte: die Herausforderung, die Lösung und die technische Architektur.",
    noProjects: "Es wurden noch keine Projekte veröffentlicht.", caseStudy: "Fallstudie ansehen", draft: "Entwurf", technologies: "Technologien",
    role: "Rolle", period: "Zeitraum", status: "Status", active: "In Entwicklung", completed: "Abgeschlossen", archived: "Archiviert", whatIDid: "Mein Beitrag",
    blogSection: "Texte & Notizen", blogTitle: "Beiträge zu Engineering", blogDescription: "Gedanken zu Full-Stack-Architektur, verteilten Systemen, Typsicherheit und produktiver Softwareentwicklung.", noArticles: "Es wurden noch keine Beiträge veröffentlicht.", readArticle: "Beitrag lesen", writing: "Texte",
    aboutSection: "Profil", aboutTitle: "Über mich", educationSection: "Werdegang", educationTitle: "Ausbildung", directContact: "Direkter Kontakt", getInTouch: "Kontakt aufnehmen",
    contactDescription: "Für Fragen oder Nachrichten zu Softwareprojekten können Sie das Formular oder die angegebene E-Mail-Adresse nutzen.", email: "E-Mail", location: "Standort", profiles: "Profile", sendMessage: "Nachricht senden", name: "Name", message: "Nachricht", sending: "Wird gesendet…", sent: "Ihre Anfrage wurde gespeichert.", sendError: "Die Anfrage konnte nicht gespeichert werden.", contactPrivacyNote: "Name, E-Mail-Adresse und Nachricht werden gespeichert, damit die Anfrage bearbeitet werden kann. Dieses Formular versendet keine E-Mail. Weitere Informationen stehen im Datenschutzhinweis.", contactPrivacyLink: "Datenschutzhinweis", contactNameHint: "Geben Sie einen Namen ein (höchstens 120 Zeichen).", contactEmailHint: "Verwenden Sie eine E-Mail-Adresse, unter der Sie erreichbar sind.", contactMessageHint: "Schreiben Sie Ihre Nachricht (höchstens 5.000 Zeichen).",
    notFound: "Seite nicht gefunden", notFoundDescription: "Die aufgerufene Seite existiert nicht.", goHome: "Zur Startseite", retry: "Erneut versuchen", errorTitle: "Ein Fehler ist aufgetreten", tryAgain: "Bitte versuchen Sie es erneut.",
    projectLinks: "Projektlinks", educationLabel: "Ausbildung", profileLabel: "Profil", career: "Berufserfahrung", home: "Startseite", language: "Sprache", switchLanguage: "English",
    emptyProfile: "Es wurden noch keine Profilinformationen veröffentlicht.", emptyEducation: "Es wurden noch keine Ausbildungsstationen veröffentlicht.",
  },
} as const;
