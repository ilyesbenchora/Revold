-- Pre-computed property fill rates (populated by cron)
CREATE TABLE IF NOT EXISTS property_fill_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type text NOT NULL,       -- 'contacts', 'companies', 'deals'
  property_name text NOT NULL,
  label text NOT NULL DEFAULT '',
  group_name text NOT NULL DEFAULT '',
  is_custom boolean NOT NULL DEFAULT false,
  fill_count int NOT NULL DEFAULT 0,
  total_count int NOT NULL DEFAULT 0,
  fill_rate real NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, object_type, property_name)
);
ALTER TABLE property_fill_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON property_fill_rates
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
