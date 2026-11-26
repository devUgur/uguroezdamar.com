import type { Env } from "../env.ts";
import { DEFAULT_MODEL_CONFIG } from "./config.ts";

/**
 * Model provider keys per tenant (ADR 0033). A key is written once and never read back by the portal: D1 holds
 * it encrypted with AES-GCM under a key derived (HKDF) from the Worker secret PROVIDER_KEYS_SECRET and the tenant,
 * bound to tenant and provider as additional data, so a copied row cannot be decrypted for another tenant or provider.
 */
export const CUSTOM_PROVIDER = /^custom-[a-z0-9-]{1,30}$/;
/** Providers that need no key or only use the owner's own servers. */
const NOT_KEYED = new Set(["workers-ai", "modal"]);

export class CredentialError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface StoredCredential {
  providerId: string;
  label: string | null;
  baseUrl: string | null;
  trainsOnData: boolean | null;
  /** Last four characters of the key, so the owner can tell two keys apart. Never more. */
  keyHint: string;
  models: string[] | null;
  verifiedAt: number | null;
  lastError: string | null;
  createdBy: string | null;
  updatedAt: number;
}

export interface TenantKey {
  providerId: string;
  apiKey: string;
  label: string | null;
  baseUrl: string | null;
  trainsOnData: boolean | null;
  models: string[] | null;
}

export interface CredentialInput {
  apiKey: string;
  label?: string;
  baseUrl?: string;
  trainsOnData?: boolean;
}

interface CredentialRow {
  provider_id: string;
  label: string | null;
  base_url: string | null;
  trains_on_data: number | null;
  ciphertext: string;
  iv: string;
  key_hint: string;
  models: string | null;
  verified_at: number | null;
  last_error: string | null;
  created_by: string | null;
  updated_at: number;
}

export function keyStoreConfigured(env: Env): boolean {
  return Boolean(env.PROVIDER_KEYS_SECRET && env.PROVIDER_KEYS_SECRET.length >= 32);
}

const encoder = new TextEncoder();

async function tenantKey(env: Env, tenantId: string): Promise<CryptoKey> {
  if (!keyStoreConfigured(env)) throw new CredentialError("Die Schlüsselablage ist nicht eingerichtet (PROVIDER_KEYS_SECRET fehlt).", 503);
  const base = await crypto.subtle.importKey("raw", encoder.encode(env.PROVIDER_KEYS_SECRET), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("uguroezdamar/provider-keys/v1"), info: encoder.encode(`tenant:${tenantId}`) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const base64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unbase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

export async function encryptSecret(env: Env, tenantId: string, providerId: string, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`${tenantId}:${providerId}`) },
    await tenantKey(env, tenantId),
    encoder.encode(plaintext),
  );
  return { ciphertext: base64(new Uint8Array(sealed)), iv: base64(iv) };
}

export async function decryptSecret(env: Env, tenantId: string, providerId: string, sealed: { ciphertext: string; iv: string }): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unbase64(sealed.iv), additionalData: encoder.encode(`${tenantId}:${providerId}`) },
    await tenantKey(env, tenantId),
    unbase64(sealed.ciphertext),
  );
  return new TextDecoder().decode(plain);
}

function toStored(row: CredentialRow): StoredCredential {
  return {
    providerId: row.provider_id,
    label: row.label,
    baseUrl: row.base_url,
    trainsOnData: row.trains_on_data === null ? null : row.trains_on_data === 1,
    keyHint: row.key_hint,
    models: row.models ? (JSON.parse(row.models) as string[]) : null,
    verifiedAt: row.verified_at,
    lastError: row.last_error,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

/** What the portal may see: everything except the key. */
export async function listCredentials(env: Env, tenantId: string): Promise<StoredCredential[]> {
  const { results } = await env.DB.prepare("SELECT * FROM provider_credentials WHERE tenant_id = ? ORDER BY provider_id").bind(tenantId).all<CredentialRow>();
  return results.map(toStored);
}

/** Decrypted keys for the router. A row that cannot be decrypted (rotated secret) is skipped and logged, never fatal. */
export async function loadTenantKeys(env: Env, tenantId: string): Promise<Map<string, TenantKey>> {
  const keys = new Map<string, TenantKey>();
  if (!keyStoreConfigured(env)) return keys;
  const { results } = await env.DB.prepare("SELECT * FROM provider_credentials WHERE tenant_id = ?").bind(tenantId).all<CredentialRow>();
  for (const row of results) {
    try {
      const apiKey = await decryptSecret(env, tenantId, row.provider_id, row);
      const stored = toStored(row);
      keys.set(row.provider_id, { providerId: row.provider_id, apiKey, label: stored.label, baseUrl: stored.baseUrl, trainsOnData: stored.trainsOnData, models: stored.models });
    } catch (error) {
      console.error(`provider key ${row.provider_id} could not be decrypted`, error instanceof Error ? error.name : "error");
    }
  }
  return keys;
}

/** Checks the input; returns the normalised custom-provider fields. Throws CredentialError for the portal. */
export function validateCredential(providerId: string, input: CredentialInput): { label: string | null; baseUrl: string | null; trainsOnData: boolean | null } {
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  if (apiKey.length < 8 || apiKey.length > 1_000 || /\s/.test(apiKey)) throw new CredentialError("Der Schlüssel sieht nicht gültig aus (8–1000 Zeichen, ohne Leerzeichen).", 400);
  if (CUSTOM_PROVIDER.test(providerId)) {
    const label = typeof input.label === "string" ? input.label.trim().slice(0, 60) : "";
    if (!label) throw new CredentialError("Ein eigener Anbieter braucht einen Namen.", 400);
    let url: URL;
    try {
      url = new URL(String(input.baseUrl ?? ""));
    } catch {
      throw new CredentialError("Basis-URL fehlt oder ist ungültig (z. B. https://api.example.com/v1).", 400);
    }
    if (url.protocol !== "https:" || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname)) {
      throw new CredentialError("Die Basis-URL muss eine öffentliche https-Adresse ohne Zugangsdaten sein.", 400);
    }
    // Unknown counts as unsafe: a custom provider is kept away from private repositories unless the owner says otherwise.
    return { label, baseUrl: url.toString().replace(/\/+$/, ""), trainsOnData: input.trainsOnData !== false };
  }
  const provider = DEFAULT_MODEL_CONFIG.providers[providerId];
  if (!provider || NOT_KEYED.has(providerId) || provider.kind === "workers-ai") throw new CredentialError("Für diesen Anbieter kann kein Schlüssel hinterlegt werden.", 400);
  return { label: null, baseUrl: null, trainsOnData: null };
}

export async function saveCredential(env: Env, tenantId: string, actor: string, providerId: string, input: CredentialInput): Promise<StoredCredential> {
  const fields = validateCredential(providerId, input);
  const apiKey = input.apiKey.trim();
  const sealed = await encryptSecret(env, tenantId, providerId, apiKey);
  await env.DB.prepare(
    `INSERT INTO provider_credentials (tenant_id, provider_id, label, base_url, trains_on_data, ciphertext, iv, key_hint, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, provider_id) DO UPDATE SET label = excluded.label, base_url = excluded.base_url,
       trains_on_data = excluded.trains_on_data, ciphertext = excluded.ciphertext, iv = excluded.iv, key_hint = excluded.key_hint,
       models = NULL, verified_at = NULL, last_error = NULL, created_by = excluded.created_by, updated_at = unixepoch()`,
  )
    .bind(tenantId, providerId, fields.label, fields.baseUrl, fields.trainsOnData === null ? null : fields.trainsOnData ? 1 : 0, sealed.ciphertext, sealed.iv, apiKey.slice(-4), actor)
    .run();
  const row = await env.DB.prepare("SELECT * FROM provider_credentials WHERE tenant_id = ? AND provider_id = ?").bind(tenantId, providerId).first<CredentialRow>();
  if (!row) throw new CredentialError("Schlüssel wurde nicht gespeichert.", 500);
  return toStored(row);
}

export async function deleteCredential(env: Env, tenantId: string, providerId: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM provider_credentials WHERE tenant_id = ? AND provider_id = ?").bind(tenantId, providerId).run();
  await env.DB.prepare("DELETE FROM tenant_model_defaults WHERE tenant_id = ? AND provider_id = ?").bind(tenantId, providerId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function recordVerification(env: Env, tenantId: string, providerId: string, outcome: { models: string[] } | { error: string }): Promise<void> {
  if ("models" in outcome) {
    await env.DB.prepare("UPDATE provider_credentials SET models = ?, verified_at = unixepoch(), last_error = NULL WHERE tenant_id = ? AND provider_id = ?")
      .bind(JSON.stringify(outcome.models), tenantId, providerId)
      .run();
  } else {
    await env.DB.prepare("UPDATE provider_credentials SET last_error = ? WHERE tenant_id = ? AND provider_id = ?").bind(outcome.error.slice(0, 500), tenantId, providerId).run();
  }
}

export interface ModelDefault {
  alias: string;
  provider: string;
  model: string;
}

export async function listModelDefaults(env: Env, tenantId: string): Promise<ModelDefault[]> {
  const { results } = await env.DB.prepare("SELECT alias, provider_id, model FROM tenant_model_defaults WHERE tenant_id = ? ORDER BY alias")
    .bind(tenantId)
    .all<{ alias: string; provider_id: string; model: string }>();
  return results.map((row) => ({ alias: row.alias, provider: row.provider_id, model: row.model }));
}

export async function setModelDefault(env: Env, tenantId: string, actor: string, value: ModelDefault): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO tenant_model_defaults (tenant_id, alias, provider_id, model, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, alias) DO UPDATE SET provider_id = excluded.provider_id, model = excluded.model, updated_by = excluded.updated_by, updated_at = unixepoch()`,
  )
    .bind(tenantId, value.alias, value.provider, value.model, actor)
    .run();
}

export async function clearModelDefault(env: Env, tenantId: string, alias: string): Promise<void> {
  await env.DB.prepare("DELETE FROM tenant_model_defaults WHERE tenant_id = ? AND alias = ?").bind(tenantId, alias).run();
}
