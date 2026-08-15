-- ═══════════════════════════════════════════════════════════════════════
-- CONNECTEURS SUR MESURE — brancher un outil ABSENT du catalogue (ERP
-- maison, logiciel métier développé en interne : « GAIA »…) sans écrire de
-- code côté Revold.
--
-- Le client déclare UNE FOIS : l'URL de base, l'authentification, puis pour
-- chaque entité canonique (clients, factures, abonnements…) le chemin de
-- l'endpoint et la correspondance de ses champs JSON vers le modèle Revold.
-- La clé de jointure est l'ID DE RAPPROCHEMENT (companies.custom_id) : c'est
-- lui qui relie les enregistrements de l'outil aux entreprises du CRM.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS custom_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Slug de l'outil (« gaia ») : le provider technique vaut custom_<key> et
  -- sert partout (primary_source, source_links, mapping des identifiants).
  key text NOT NULL,
  label text NOT NULL,
  base_url text NOT NULL,
  -- none | bearer | header | query
  auth_type text NOT NULL DEFAULT 'none',
  -- Nom de l'en-tête (« X-API-Key ») ou du paramètre d'URL (« api_key »).
  auth_param text,
  auth_value text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
ALTER TABLE custom_connectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON custom_connectors;
CREATE POLICY "tenant_isolation" ON custom_connectors
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS custom_connector_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES custom_connectors(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- companies | invoices | subscriptions | transactions | tickets
  entity text NOT NULL,
  path text NOT NULL,
  -- Chemin pointé vers le TABLEAU d'enregistrements dans la réponse
  -- (« data », « results.items »… vide = la racine est déjà un tableau).
  records_path text,
  -- { type: none|page|offset|cursor, param, sizeParam, size, cursorPath }
  pagination jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  -- { champ canonique Revold → chemin pointé dans l'enregistrement source }
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_count integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, entity)
);
ALTER TABLE custom_connector_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON custom_connector_endpoints;
CREATE POLICY "tenant_isolation" ON custom_connector_endpoints
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
