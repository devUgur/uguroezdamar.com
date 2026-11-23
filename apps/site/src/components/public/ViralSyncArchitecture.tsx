interface ViralSyncArchitectureProps {
  locale?: "en" | "de";
}

export function ViralSyncArchitecture({ locale = "en" }: ViralSyncArchitectureProps) {
  const de = locale === "de";

  const nodes = [
    {
      id: "web",
      tag: "TIER 01",
      title: de ? "Web-Anwendung" : "Web Application",
      runtime: "Next.js App Router",
      items: de
        ? ["React Server Components & Actions", "Optimistische Kalenderansichten", "Typsichere Benutzeroberfläche"]
        : ["React Server Components & Actions", "Optimistic Calendar Views", "Type-safe User Interface"],
    },
    {
      id: "edge",
      tag: "TIER 02",
      title: de ? "Edge API" : "Edge API Tier",
      runtime: "Hono · Cloudflare Workers",
      items: de
        ? [
            "Geografisch verteilte API-Ausführung nahe an den Nutzern",
            "Entkoppelte Veröffentlichungs-Routen",
            "Provider-Fähigkeiten-Manifest",
          ]
        : [
            "Geographically distributed API execution close to users",
            "Decoupled Publishing Routes",
            "Provider Capability Manifest",
          ],
    },
    {
      id: "data",
      tag: "DATA LAYER",
      title: de ? "Datenbank" : "Database Layer",
      runtime: "Neon Postgres (Frankfurt, EU)",
      items: de
        ? ["Drizzle ORM & Schema-Migrationen", "Verbindungs-Pooling via WebSocket", "Zod-Validierung an Laufzeitgrenzen"]
        : ["Drizzle ORM & Schema Migrations", "WebSocket Connection Pooling", "Runtime Zod Schema Validation"],
    },
    {
      id: "providers",
      tag: "INTEGRATION",
      title: de ? "Provider-Ports" : "Provider Ports",
      runtime: "External Social Adapters",
      items: de
        ? ["Instagram, TikTok, YouTube, LinkedIn", "Token-Verschlüsselung im Ruhezustand", "Simulierte Provider für CI-Tests"]
        : ["Instagram, TikTok, YouTube, LinkedIn", "Encrypted Token Lifecycle", "Simulated Providers for CI Tests"],
    },
  ];

  return (
    <figure
      role="figure"
      aria-label={de ? "ViralSync Systemarchitektur" : "ViralSync System Architecture"}
      className="my-8 rounded-none border border-border bg-surface/50 p-6 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/80 pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {de ? "Systemarchitektur & Datenfluss" : "System Architecture & Data Flow"}
          </span>
          <h3 className="font-serif text-xl font-medium text-foreground sm:text-2xl">
            ViralSync Monorepo Pipeline
          </h3>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          TypeScript · Next.js · Hono · Neon
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="flex flex-col justify-between border border-border bg-background p-5 transition-colors hover:border-foreground/30"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
                  {node.tag}
                </span>
                <span className="rounded-xs border border-border/60 bg-surface px-2 py-0.5 font-mono text-[11px] text-foreground/80">
                  {node.runtime}
                </span>
              </div>
              <h4 className="mt-2 font-serif text-lg font-medium text-foreground">
                {node.title}
              </h4>
              <ul className="mt-3 space-y-1.5 font-mono text-xs text-muted-foreground">
                {node.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-foreground/40" aria-hidden="true">↳</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <figcaption className="mt-6 border-t border-border/60 pt-4 font-mono text-[11px] leading-5 text-muted-foreground">
        {de
          ? "Architekturübersicht: Entkoppelte Next.js-Weboberfläche und Hono-Edge-API greifen auf gemeinsame Domänen- und Datenbankschichten (Neon Postgres) zu; soziale Netzwerke sind über einheitliche Provider-Ports gekapselt."
          : "Architecture Overview: Decoupled Next.js web frontend and Hono edge API share core domain and database layers (Neon Postgres); external social networks are isolated behind unified provider ports."}
      </figcaption>
    </figure>
  );
}

export default ViralSyncArchitecture;
