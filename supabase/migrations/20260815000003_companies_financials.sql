-- Données officielles ÉVOLUTIVES des entreprises (enrichissement Suivi →
-- Enrichissement) : tranche d'effectif (URSSAF/INSEE via Sirene) et dernier CA
-- déposé (INPI). Colonnes séparées des champs CRM (employee_count /
-- annual_revenue, synchronisés depuis HubSpot) : on distingue la donnée
-- DÉCLARÉE par le client de la donnée OFFICIELLE, datée et rafraîchissable.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS official_employee_range text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS official_employee_year int;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS official_revenue numeric;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS official_revenue_year int;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
