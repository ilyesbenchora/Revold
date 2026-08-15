-- Doublons détectés par l'enrichissement : quand le registre attribue à une
-- fiche un SIREN DÉJÀ porté par une autre entreprise de l'organisation, la
-- contrainte d'unicité (idx_companies_siren) refuse l'écriture — c'est en
-- réalité une information précieuse : les deux fiches désignent la même
-- entreprise. On la consigne au lieu de la perdre (et surtout au lieu de
-- retenter la même ligne indéfiniment).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS duplicate_of_siren text;
CREATE INDEX IF NOT EXISTS idx_companies_org_duplicate
  ON companies (organization_id, duplicate_of_siren);
