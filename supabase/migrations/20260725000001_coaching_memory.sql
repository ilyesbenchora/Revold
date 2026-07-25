-- Mémoire de coaching : résumé de séance + plan d'action suivi entre les séances.

-- Résumé généré par l'agent à la clôture d'une séance.
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS summary text;

-- Engagements (plan d'action) pris en fin de séance, suivis jusqu'au RDV suivant.
CREATE TABLE IF NOT EXISTS coaching_commitments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        text NOT NULL,
  session_id      uuid REFERENCES coaching_sessions(id) ON DELETE SET NULL,
  title           text NOT NULL,
  detail          text,
  due_date        date,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dropped')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coaching_commitments_org
  ON coaching_commitments (organization_id, category, status, created_at DESC);

ALTER TABLE coaching_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON coaching_commitments FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
