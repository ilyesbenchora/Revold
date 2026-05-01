-- 8.5 — RBAC équipe + invitations
--
-- profiles.role passe à un enum applicatif (admin / manager / rep).
-- L'ancien default 'member' est mappé vers 'admin' (cohérent : le créateur de
-- l'org est admin). On utilise un CHECK plutôt qu'un type enum pour rester
-- compatibles avec les seeds existants et faciliter l'évolution.

-- Mapping existant : tout 'member' devient 'admin' (1er user d'une org = admin)
UPDATE profiles SET role = 'admin' WHERE role IN ('member', 'owner', 'user');

ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'rep';

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'manager', 'rep'));

-- Table invitations — magic link pour inviter quelqu'un dans une org
CREATE TABLE IF NOT EXISTS invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             text NOT NULL,
  role              text NOT NULL DEFAULT 'rep'
    CHECK (role IN ('admin', 'manager', 'rep')),

  -- Token signé pour le lien d'invitation (32 bytes random hex = 64 chars)
  token             text NOT NULL UNIQUE,

  -- Inviteur + statut
  invited_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at       timestamptz,
  expires_at        timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  revoked_at        timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_org_email_pending
  ON invitations (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- RLS : seul un admin/manager de l'org peut lire/créer des invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins read invitations"
  ON invitations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

CREATE POLICY "Org admins create invitations"
  ON invitations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

CREATE POLICY "Org admins revoke invitations"
  ON invitations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- Table audit_log — actions sensibles (mentionnée Sécurité 8.9)
CREATE TABLE IF NOT EXISTS audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action            text NOT NULL,    -- "member.invited", "member.role_changed", "member.removed", "data.exported", "settings.changed"
  target_type       text,             -- "profile", "integration", "report", etc.
  target_id         text,             -- internal_id ou external_id
  metadata          jsonb,
  ip_address        text,
  user_agent        text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_date ON audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Lecture : admins voient tout, managers voient les actions de leurs reports.
-- Pour simplifier on autorise admin + manager pour le V1.
CREATE POLICY "Org admins read audit log"
  ON audit_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- Aucune écriture user-side : le service-role écrit via les API routes
