-- Model provider keys per tenant (ADR 0033). The key itself is stored only encrypted (AES-GCM, key derived from the
-- Worker secret PROVIDER_KEYS_SECRET); the portal sees the provider, a four-character hint and the test result.
CREATE TABLE provider_credentials (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider_id TEXT NOT NULL,
  -- Only for providers the tenant adds itself (id "custom-…"): name, OpenAI-compatible base URL, data policy.
  label TEXT,
  base_url TEXT,
  trains_on_data INTEGER,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  -- JSON array of model ids the provider listed with this key; NULL until tested.
  models TEXT,
  verified_at INTEGER,
  last_error TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, provider_id)
);

-- The model a tenant prefers for a role alias (chef-smart, coder, worker-cheap). Tried before the built-in chain.
CREATE TABLE tenant_model_defaults (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  alias TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (tenant_id, alias)
);
