-- Rapport d'audit de sync par connecteur (1 ligne par org × provider, écrasée
-- à chaque sync). Alimente la page Audit qualité → Audit onboarding :
-- couverture des identifiants (SIREN, TVA, email…), méthodes de rapprochement,
-- records ignorés — tout ce que Revold détecte quand un outil est branché.
CREATE TABLE IF NOT EXISTS connector_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider)
);
ALTER TABLE connector_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON connector_audits
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_connector_audits_org ON connector_audits(organization_id);
