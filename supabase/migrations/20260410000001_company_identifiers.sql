-- ============================================================
-- Identifiants uniques d'entreprise pour la résolution cross-source
--
-- Le SIREN (9 chiffres) est le meilleur identifiant pour matcher des
-- entreprises entre HubSpot, Stripe, Pennylane, Sellsy, etc. car il est
-- unique par personne morale en France. Complété par le SIRET (14 chiffres,
-- spécifique à l'établissement) et le numéro de TVA intracommunautaire.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS siren text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS siret text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_number text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'FR';

-- Unique constraint on SIREN per org (a company can't appear twice with the same SIREN)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_siren
  ON companies (organization_id, siren) WHERE siren IS NOT NULL;

-- Same for VAT number
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_vat
  ON companies (organization_id, vat_number) WHERE vat_number IS NOT NULL;

-- Contact identifiers for cross-source matching
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS secondary_email text;
