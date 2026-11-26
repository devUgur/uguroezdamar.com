import type { ModelSettings } from "../types";
import { CustomProviderForm } from "./CustomProviderForm";
import { ProviderCard } from "./ProviderCard";
import { RoleDefaults } from "./RoleDefaults";

interface ModelSettingsViewProps {
  settings: ModelSettings;
  notice?: string;
  error?: string;
}

/** /models: which language models the agents may use, with which keys, and which model each role tries first. */
export function ModelSettingsView({ settings, notice, error }: ModelSettingsViewProps) {
  const { catalog, credentials, canManage } = settings;
  const byProvider = new Map(credentials.map((credential) => [credential.providerId, credential]));
  const providers = catalog?.providers ?? [];
  const active = providers.filter((provider) => provider.available);
  const inactive = providers.filter((provider) => !provider.available);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Einstellungen</p>
        <h1 className="font-serif text-3xl">Modelle &amp; Schlüssel</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Sobald ein Schlüssel hinterlegt ist, stehen die Modelle dieses Anbieters im Chat und für die Rollen zur Wahl. Schlüssel werden verschlüsselt in der Agenten-API gespeichert und nie wieder angezeigt, nur ihre letzten vier Zeichen. Betriebs-Secrets der Plattform bleiben in Infisical; Schlüssel aus dem Portal gehören dem Mandanten und gehen nicht dorthin.
        </p>
        {!canManage ? <p className="text-sm text-muted-foreground">Ändern darf nur der Owner.</p> : null}
      </header>

      {notice ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error || settings.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error ?? settings.error}
        </p>
      ) : null}
      {catalog && !catalog.keyStore ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Die Schlüsselablage ist noch nicht eingerichtet: Der Agenten-API fehlt PROVIDER_KEYS_SECRET (pnpm ugur api secrets --apply).
        </p>
      ) : null}

      {catalog ? (
        <>
          <section className="flex flex-col gap-4" aria-labelledby="roles-title">
            <h2 id="roles-title" className="font-serif text-xl">
              Standardmodell je Rolle
            </h2>
            <p className="text-sm text-muted-foreground">
              Fällt das gewählte Modell aus, geht es in der eingebauten Reihenfolge weiter. In privaten Repositories antworten nur Anbieter ohne Datenauswertung.
            </p>
            <RoleDefaults catalog={catalog} canManage={canManage} />
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="active-title">
            <h2 id="active-title" className="font-serif text-xl">
              Aktive Anbieter ({active.length})
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {active.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} credential={byProvider.get(provider.id)} canManage={canManage} keyStore={catalog.keyStore} />
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="inactive-title">
            <h2 id="inactive-title" className="font-serif text-xl">
              Weitere Anbieter
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {inactive.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} credential={byProvider.get(provider.id)} canManage={canManage} keyStore={catalog.keyStore} />
              ))}
            </ul>
          </section>

          {canManage && catalog.keyStore ? (
            <section className="flex flex-col gap-4" aria-labelledby="custom-title">
              <h2 id="custom-title" className="font-serif text-xl">
                Eigener Anbieter
              </h2>
              <p className="text-sm text-muted-foreground">Jeder Endpunkt im OpenAI-Format, z. B. ein eigener vLLM-Server oder ein Proxy wie LiteLLM.</p>
              <CustomProviderForm />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
