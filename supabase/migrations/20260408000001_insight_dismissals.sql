-- Track which insight templates have been marked as done by a user
CREATE TABLE IF NOT EXISTS insight_dismissals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_key    text NOT NULL,
  dismissed_at    timestamptz DEFAULT now(),
  UNIQUE(organization_id, template_key)
);

ALTER TABLE insight_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON insight_dismissals FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert dismissals" ON insight_dismissals FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
