import type { GithubStatus } from "../types";

interface GithubConnectionProps {
  status: GithubStatus | null;
  error: string | null;
}

const HEADLINES = {
  app: "GitHub App verbunden",
  token: "Zugang über persönlichen Token",
  none: "Noch keine GitHub-Verbindung",
} as const;

/** How the agents reach GitHub: the app (preferred) or the fallback token, and where the app is installed. */
export function GithubConnection({ status, error }: GithubConnectionProps) {
  if (!status) {
    return error ? (
      <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
        {error}
      </p>
    ) : null;
  }
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-4" aria-labelledby="github-title">
      <h2 id="github-title" className="font-serif text-xl">
        {HEADLINES[status.mode]}
      </h2>
      {status.mode === "none" ? (
        <p className="text-sm text-muted-foreground">Ohne App oder Token können die Agenten nicht auf GitHub zugreifen. Die Einrichtung steht in ADR 0031.</p>
      ) : null}
      {status.mode === "token" ? (
        <p className="text-sm text-muted-foreground">Der Token gilt für ein einziges Konto. Eine GitHub App deckt auch Organisationen ab und braucht kein dauerhaftes Passwort.</p>
      ) : null}
      {status.installations.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {status.installations.map((installation) => (
            <li key={installation.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{installation.account}</span>
              <span className="text-muted-foreground">{installation.selection === "all" ? "alle Repositories" : "ausgewählte Repositories"}</span>
              {installation.allowed ? null : (
                <span className="text-muted-foreground">· nicht freigegeben: den Besitzer in GITHUB_OWNERS eintragen, damit Agenten dort arbeiten</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {status.mode === "app" && status.tokenConfigured ? <p className="text-xs text-muted-foreground">Der persönliche Token bleibt als Rückfall und zum Anlegen von Repositories.</p> : null}
    </section>
  );
}
