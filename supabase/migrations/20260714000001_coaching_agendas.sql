-- Agenda de coaching par catégorie : objectifs, pains, cadence de RDV, prochain RDV.
-- 1 ligne par (organization_id, category).

CREATE TABLE IF NOT EXISTS coaching_agendas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        text NOT NULL,
  objectives      text,
  pains           text,
  cadence         text NOT NULL DEFAULT 'monthly', -- weekly | biweekly | monthly | quarterly
  next_meeting_at date,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, category)
);

ALTER TABLE coaching_agendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON coaching_agendas FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
