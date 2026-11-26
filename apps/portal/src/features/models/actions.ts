"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agentsApi } from "@/src/adapters/agents-api";
import { currentOrganizationAccess } from "@/src/server/organization-access";

/** Server Actions are public endpoints: each one checks that the caller is the owner. Keys are never logged. */
async function owner(): Promise<{ actor: string; scopes: readonly string[] }> {
  const access = await currentOrganizationAccess();
  if (!access.canManage) back("error", "Nur der Owner darf Modellschlüssel und Modellwahl ändern.");
  return { actor: access.actor, scopes: ["providers:write"] };
}

const PROVIDER_ID = /^[a-z0-9-]{1,40}$/;
const ALIAS = /^[a-z0-9-]{1,40}$/;

function back(kind: "notice" | "error", message: string): never {
  revalidatePath("/models");
  redirect(`/models?${kind}=${encodeURIComponent(message)}`);
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

interface SavedCredential {
  credential: { ok: boolean; models: string[] | null; lastError: string | null };
}

function savedMessage(label: string, result: SavedCredential): string {
  const { ok, models, lastError } = result.credential;
  return ok ? `Schlüssel für ${label} gespeichert und geprüft: ${models?.length ?? 0} Modelle verfügbar.` : `Schlüssel für ${label} gespeichert, aber der Test schlug fehl: ${lastError ?? "unbekannt"}`;
}

export async function saveProviderKey(formData: FormData): Promise<void> {
  const providerId = String(formData.get("providerId") ?? "");
  const label = String(formData.get("label") ?? providerId);
  const apiKey = String(formData.get("apiKey") ?? "");
  const who = await owner();
  if (!PROVIDER_ID.test(providerId)) back("error", "Unbekannter Anbieter.");
  let message: string;
  try {
    const result = await agentsApi<SavedCredential>(`/api/providers/${providerId}/key`, who.actor, { method: "PUT", body: { apiKey }, scopes: who.scopes });
    message = savedMessage(label, result);
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", message);
}

export async function addCustomProvider(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  const who = await owner();
  if (!slug) back("error", "Bitte einen Namen angeben.");
  let message: string;
  try {
    const result = await agentsApi<SavedCredential>(`/api/providers/custom-${slug}/key`, who.actor, {
      method: "PUT",
      body: {
        apiKey: String(formData.get("apiKey") ?? ""),
        label: name,
        baseUrl: String(formData.get("baseUrl") ?? ""),
        trainsOnData: formData.get("private") !== "on",
      },
      scopes: who.scopes,
    });
    message = savedMessage(name, result);
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", message);
}

export async function verifyProviderKey(formData: FormData): Promise<void> {
  const providerId = String(formData.get("providerId") ?? "");
  const who = await owner();
  if (!PROVIDER_ID.test(providerId)) back("error", "Unbekannter Anbieter.");
  let result: { ok: boolean; models: string[] | null; lastError: string | null };
  try {
    result = await agentsApi(`/api/providers/${providerId}/verify`, who.actor, { method: "POST", scopes: who.scopes });
  } catch (error) {
    back("error", failure(error));
  }
  if (result.ok) back("notice", `Schlüssel funktioniert: ${result.models?.length ?? 0} Modelle verfügbar.`);
  back("error", `Test fehlgeschlagen: ${result.lastError ?? "unbekannt"}`);
}

export async function deleteProviderKey(formData: FormData): Promise<void> {
  const providerId = String(formData.get("providerId") ?? "");
  const who = await owner();
  if (!PROVIDER_ID.test(providerId)) back("error", "Unbekannter Anbieter.");
  try {
    await agentsApi(`/api/providers/${providerId}/key`, who.actor, { method: "DELETE", scopes: who.scopes });
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", "Schlüssel gelöscht. Laufende Gespräche nutzen ab dem nächsten Schritt die übrigen Anbieter.");
}

export async function setRoleModel(formData: FormData): Promise<void> {
  const alias = String(formData.get("alias") ?? "");
  const choice = String(formData.get("choice") ?? "");
  const who = await owner();
  if (!ALIAS.test(alias)) back("error", "Unbekannte Rolle.");
  try {
    if (!choice) {
      await agentsApi(`/api/models/defaults/${alias}`, who.actor, { method: "DELETE", scopes: who.scopes });
    } else {
      const [provider, ...rest] = choice.split("::");
      await agentsApi(`/api/models/defaults/${alias}`, who.actor, { method: "PUT", body: { provider, model: rest.join("::") }, scopes: who.scopes });
    }
  } catch (error) {
    back("error", failure(error));
  }
  back("notice", choice ? `Standardmodell für ${alias} gesetzt.` : `${alias} nutzt wieder die eingebaute Reihenfolge.`);
}
