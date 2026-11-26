import { Button } from "@ugur/ui";
import { deleteProviderKey, saveProviderKey, verifyProviderKey } from "../actions";
import type { Credential, Provider } from "../types";

interface ProviderCardProps {
  provider: Provider;
  credential: Credential | undefined;
  canManage: boolean;
  keyStore: boolean;
}

const INPUT = "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm";

function keyLine(provider: Provider, credential: Credential | undefined): string {
  if (provider.keySource === "builtin") return "Kein Schlüssel nötig.";
  if (credential) return `Schlüssel im Portal hinterlegt (…${credential.keyHint}).`;
  if (provider.keySource === "environment") return "Schlüssel als Worker-Secret des Owners gesetzt.";
  return "Kein Schlüssel hinterlegt.";
}

function testLine(credential: Credential | undefined): { text: string; failed: boolean } | null {
  if (!credential) return null;
  if (credential.lastError) return { text: `Letzter Test fehlgeschlagen: ${credential.lastError}`, failed: true };
  if (credential.verifiedAt) return { text: `Geprüft am ${new Date(credential.verifiedAt * 1000).toLocaleString("de-DE")} · ${credential.models?.length ?? 0} Modelle`, failed: false };
  return { text: "Noch nicht geprüft.", failed: false };
}

/** One provider: what it is for, its data policy, where the key comes from, and the owner's controls. */
export function ProviderCard({ provider, credential, canManage, keyStore }: ProviderCardProps) {
  const test = testLine(credential);
  const keyed = provider.keySource !== "builtin";
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium">{provider.label}</h3>
          {provider.description ? <p className="text-xs text-muted-foreground">{provider.description}</p> : null}
        </div>
        <span className={provider.available ? "shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground" : "shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"}>
          {provider.available ? "aktiv" : "inaktiv"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {provider.trainsOnData ? "Darf Eingaben auswerten: nie für private Repositories" : "Keine Datenauswertung: auch für private Repositories"}
        {provider.paid ? " · kostenpflichtig" : " · kostenlos"} · {provider.models.length} Modelle
      </p>
      <p className="text-sm">{keyLine(provider, credential)}</p>
      {test ? <p className={test.failed ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{test.text}</p> : null}

      {keyed && canManage && keyStore ? (
        <form action={saveProviderKey} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="providerId" value={provider.id} />
          <input type="hidden" name="label" value={provider.label} />
          <label className="sr-only" htmlFor={`key-${provider.id}`}>
            API-Schlüssel für {provider.label}
          </label>
          <input
            id={`key-${provider.id}`}
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
            minLength={8}
            placeholder={credential ? "Neuen Schlüssel eintragen" : "API-Schlüssel eintragen"}
            className={INPUT}
          />
          <Button type="submit">{credential ? "Ersetzen" : "Speichern"}</Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (credential || provider.keySource === "environment") && provider.canDiscover ? (
          <form action={verifyProviderKey}>
            <input type="hidden" name="providerId" value={provider.id} />
            <Button type="submit" variant="secondary">
              Testen und Modelle laden
            </Button>
          </form>
        ) : null}
        {canManage && credential ? (
          <form action={deleteProviderKey}>
            <input type="hidden" name="providerId" value={provider.id} />
            <Button type="submit" variant="secondary">
              Schlüssel löschen
            </Button>
          </form>
        ) : null}
        {provider.keyUrl && keyed ? (
          <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">
            Schlüssel erstellen
          </a>
        ) : null}
      </div>
    </li>
  );
}
