/** Where a provider's key comes from (agent API, ADR 0033). */
export type KeySource = "tenant" | "environment" | "builtin" | "none";

export interface ProviderModel {
  id: string;
  label: string;
  note?: string;
  inputUsdPerM: number | null;
  outputUsdPerM: number | null;
  /** Listed by the provider for this key, not part of the curated list. */
  discovered?: boolean;
}

export interface Provider {
  id: string;
  label: string;
  shortLabel: string;
  kind: "openai-compatible" | "anthropic" | "workers-ai";
  description: string | null;
  keyUrl: string | null;
  available: boolean;
  keySource: KeySource;
  trainsOnData: boolean;
  paid: boolean;
  custom: boolean;
  canDiscover: boolean;
  models: ProviderModel[];
}

export interface ModelDefault {
  alias: string;
  provider: string;
  model: string;
}

export interface Catalog {
  providers: Provider[];
  aliases: Record<string, { provider: string; model: string }[]>;
  defaults: ModelDefault[];
  agentAliases: Record<string, string>;
  keyStore: boolean;
}

/** A stored key as the portal sees it: never the key, only its last four characters. */
export interface Credential {
  providerId: string;
  label: string | null;
  baseUrl: string | null;
  trainsOnData: boolean | null;
  keyHint: string;
  models: string[] | null;
  verifiedAt: number | null;
  lastError: string | null;
  createdBy: string | null;
  updatedAt: number;
}

export interface ModelSettings {
  catalog: Catalog | null;
  credentials: Credential[];
  canManage: boolean;
  error: string | null;
}
