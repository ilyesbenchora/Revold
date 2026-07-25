-- Dates d'entrée dans chaque lifecycle stage (socle de la page Alignement :
-- temps moyen par étape, délai MQL → deal, relais marketing/ventes).
-- Peuplées par l'ETL HubSpot (hs_v2_date_entered_*) ; lifecycle_stage et
-- hs_created_at sont backfillés depuis raw_data (déjà collectés).
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lifecycle_stage text,
  ADD COLUMN IF NOT EXISTS hs_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_date timestamptz,
  ADD COLUMN IF NOT EXISTS mql_date timestamptz,
  ADD COLUMN IF NOT EXISTS sql_date timestamptz,
  ADD COLUMN IF NOT EXISTS opportunity_date timestamptz,
  ADD COLUMN IF NOT EXISTS customer_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_org_mql_date ON contacts(organization_id, mql_date);
CREATE INDEX IF NOT EXISTS idx_contacts_org_lifecycle ON contacts(organization_id, lifecycle_stage);

-- Backfill immédiat depuis raw_data pour les propriétés DÉJÀ collectées.
-- Les dates hs_v2_date_entered_* n'arrivent qu'au prochain sync (delta pour les
-- contacts modifiés, full pour tout l'historique).
UPDATE contacts SET
  lifecycle_stage = COALESCE(lifecycle_stage, raw_data->'properties'->>'lifecyclestage'),
  hs_created_at = COALESCE(hs_created_at, NULLIF(raw_data->'properties'->>'createdate', '')::timestamptz)
WHERE raw_data IS NOT NULL;
