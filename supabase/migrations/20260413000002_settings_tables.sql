-- ============================================================
-- Fix RLS policies + new settings tables
-- ============================================================

-- Fix RLS on entity_resolution_config (use profile-based pattern)
DROP POLICY IF EXISTS "Tenant isolation" ON entity_resolution_config;
CREATE POLICY "tenant_isolation" ON entity_resolution_config
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation" ON identifier_field_mapping;
CREATE POLICY "tenant_isolation" ON identifier_field_mapping
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Field authority config
CREATE TABLE IF NOT EXISTS field_authority_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity text NOT NULL,
  field text NOT NULL,
  priority text[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, entity, field)
);
ALTER TABLE field_authority_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON field_authority_config
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Sync config
CREATE TABLE IF NOT EXISTS sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  frequency text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, category)
);
ALTER TABLE sync_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sync_config
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
