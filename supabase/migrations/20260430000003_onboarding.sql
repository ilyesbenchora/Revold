-- 8.10 — Self-serve onboarding wizard
--
-- Trace l'avancement onboarding par org. Une org "onboardée" a au moins
-- complété les 3 étapes critiques : choix d'objectifs business + connexion
-- d'au moins 1 outil source + premier sync visible.

CREATE TABLE IF NOT EXISTS onboarding_state (
  organization_id        uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Étapes (NULL = pas encore franchie)
  welcomed_at            timestamptz,        -- step 1 : bienvenue vue
  hubspot_connected_at   timestamptz,        -- step 2 : OAuth HubSpot OK
  objectives_set_at      timestamptz,        -- step 3 : équipes/objectifs choisis
  first_sync_seen_at     timestamptz,        -- step 4 : 1er sync visible
  completed_at           timestamptz,        -- final : redirige plus vers /onboarding
  skipped                boolean NOT NULL DEFAULT false,

  -- Choix faits dans le wizard
  objectives             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ex: ["sales", "marketing"]

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their org onboarding state"
  ON onboarding_state FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users update their org onboarding state"
  ON onboarding_state FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users insert onboarding state"
  ON onboarding_state FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
