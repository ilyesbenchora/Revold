-- ============================================================
-- Entity resolution configuration
-- Persists the user's matching rules and field mappings.
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_resolution_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id text NOT NULL,          -- e.g. 'siren_match', 'vat_match', 'exact_email'
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0, -- lower = higher priority (0 = top)
  config jsonb NOT NULL DEFAULT '{}', -- rule-specific settings
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, rule_id)
);

ALTER TABLE entity_resolution_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON entity_resolution_config
  FOR ALL USING (organization_id = (current_setting('app.current_org_id', true))::uuid);

-- Field mapping: which provider field maps to which canonical identifier
-- e.g. provider=hubspot, canonical_field=siren, provider_field=siren (custom property name)
CREATE TABLE IF NOT EXISTS identifier_field_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,           -- 'hubspot', 'stripe', 'pennylane', etc.
  canonical_field text NOT NULL,    -- 'siren', 'siret', 'vat_number', 'external_id'
  provider_field text NOT NULL,     -- the actual field name in the provider ('siren', 'customer.metadata.siren', etc.)
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider, canonical_field)
);

ALTER TABLE identifier_field_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON identifier_field_mapping
  FOR ALL USING (organization_id = (current_setting('app.current_org_id', true))::uuid);

-- Cleanup: remove low-confidence identifiers from companies/contacts
ALTER TABLE companies DROP COLUMN IF EXISTS linkedin_url;
ALTER TABLE contacts DROP COLUMN IF EXISTS linkedin_url;
ALTER TABLE contacts DROP COLUMN IF EXISTS secondary_email;
