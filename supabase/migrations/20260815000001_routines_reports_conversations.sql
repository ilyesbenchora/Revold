-- ============================================================
-- Chantier « sortie du localStorage » — travail d'équipe & multi-appareils.
-- Trois tables remplacent les stores navigateur :
--   agent_routines      : routines des agents (ex revold:agent-routines:v1),
--                         partagées par l'organisation, exécutées par le cron
--                         serveur /api/cron/run-routines (plus besoin d'avoir
--                         la page ouverte).
--   saved_reports       : rapports enregistrés + rapports de routine
--                         (ex revold:saved-reports:v1), visibles par toute
--                         l'équipe (le dirigeant partage ses récaps).
--   agent_conversations : historique de chat par utilisateur × agent
--                         (ex revold:agent:<agentKey>:v1), multi-appareils.
-- ============================================================

-- ── Routines des agents (partagées par org, exécutées par cron) ──
CREATE TABLE IF NOT EXISTS agent_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid,
  agent_key text NOT NULL,
  label text NOT NULL,
  prompt text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily',
  time_of_day text NOT NULL DEFAULT '09:00',
  -- Fuseau de l'utilisateur au moment de la création : le cron calcule
  -- l'échéance dans CE fuseau (une routine « 9h00 » tourne à 9h locales).
  timezone text NOT NULL DEFAULT 'Europe/Paris',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_routines_org_agent ON agent_routines (organization_id, agent_key);
ALTER TABLE agent_routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON agent_routines;
CREATE POLICY "tenant_isolation" ON agent_routines
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ── Rapports enregistrés (chat + routines), partagés par org ──
CREATE TABLE IF NOT EXISTS saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid,
  agent_key text NOT NULL,
  agent_label text,
  title text NOT NULL,
  summary text,
  report jsonb,
  chart jsonb,
  alert jsonb,
  alert_id uuid,
  origin text NOT NULL DEFAULT 'chat',
  routine_label text,
  routine_id uuid REFERENCES agent_routines(id) ON DELETE SET NULL,
  analysis text,
  hidden boolean NOT NULL DEFAULT false,
  saved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_reports_org_date ON saved_reports (organization_id, saved_at DESC);
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON saved_reports;
CREATE POLICY "tenant_isolation" ON saved_reports
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ── Conversations d'agents (privées par utilisateur, multi-appareils) ──
CREATE TABLE IF NOT EXISTS agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  agent_key text NOT NULL,
  -- Id généré côté client (réconciliation avec l'état local / offline).
  client_id text NOT NULL,
  title text,
  -- Conversation complète telle que manipulée par le chat (messages, méta…).
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_key, client_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations (user_id, agent_key, updated_at DESC);
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_only" ON agent_conversations;
CREATE POLICY "owner_only" ON agent_conversations
  FOR ALL USING (user_id = auth.uid());
