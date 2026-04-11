-- ============================================================
-- Activated reports — persists which reports the user has turned on
-- ============================================================

CREATE TABLE IF NOT EXISTS activated_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       text NOT NULL,
  report_type     text NOT NULL DEFAULT 'single',  -- single | multi
  title           text NOT NULL,
  display_category text NOT NULL,
  metrics         jsonb DEFAULT '[]',
  icon            text,
  activated_at    timestamptz DEFAULT now(),
  activated_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(organization_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_activated_reports_org ON activated_reports(organization_id);
ALTER TABLE activated_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON activated_reports;
CREATE POLICY "Tenant isolation" ON activated_reports FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
