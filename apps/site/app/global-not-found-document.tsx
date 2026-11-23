"use client";

import { usePathname } from "next/navigation";

export default function GlobalNotFoundDocument({ fontClassName }: { fontClassName: string }) {
  const german = usePathname()?.startsWith("/de/") ?? false;
  return (
    <html lang={german ? "de" : "en"} className={fontClassName}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <main className="site-container flex min-h-dvh flex-col justify-center py-16">
          <p className="page-eyebrow">404 · {german ? "Nicht gefunden" : "Not found"}</p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight md:text-6xl">{german ? "Seite nicht gefunden" : "Page not found"}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{german ? "Die aufgerufene Seite existiert nicht oder wurde verschoben." : "The page you are looking for does not exist or has moved."}</p>
          <a href={german ? "/de" : "/"} className="mt-8 inline-flex min-h-11 w-fit items-center border border-foreground px-5 font-mono text-xs uppercase tracking-widest hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{german ? "Zur Startseite" : "Go home"}</a>
        </main>
      </body>
    </html>
  );
}
