-- Jeux de données importés depuis un fichier Excel/CSV ou un Google Sheets.
-- Les lignes sont stockées inline en jsonb (bornées à 5000 lignes côté app).
CREATE TABLE IF NOT EXISTS imported_datasets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  source_type     text NOT NULL,              -- 'csv' | 'gsheet'
  source_ref      text,                       -- nom de fichier ou URL de la feuille
  columns         jsonb NOT NULL DEFAULT '[]',
  rows            jsonb NOT NULL DEFAULT '[]',
  row_count       integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imported_datasets_org ON imported_datasets (organization_id, created_at DESC);

ALTER TABLE imported_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON imported_datasets FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
