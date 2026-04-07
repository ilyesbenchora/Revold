CREATE TABLE IF NOT EXISTS alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text NOT NULL,
  impact          text NOT NULL,
  category        text NOT NULL DEFAULT 'sales',
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON alerts FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert alerts" ON alerts FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
