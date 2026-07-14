-- Séances de coaching réalisées (terminées via un agent coach).
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        text NOT NULL,
  ended_at        timestamptz NOT NULL DEFAULT now(),
  auto            boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_org ON coaching_sessions (organization_id, ended_at DESC);

ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON coaching_sessions FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
