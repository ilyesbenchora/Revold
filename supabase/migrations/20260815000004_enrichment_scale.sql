-- Enrichissement À L'ÉCHELLE (cron enrich-companies) : état de scan et file
-- de validation — le cron avance dans la base au lieu de rescanner les mêmes
-- lots, applique seul les correspondances SÛRES et range les incertaines en
-- candidats que l'utilisateur valide depuis Suivi → Enrichissement.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sirene_checked_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_siren text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_siret text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_legal_name text;
CREATE INDEX IF NOT EXISTS idx_companies_org_sirene_checked
  ON companies (organization_id, sirene_checked_at);
