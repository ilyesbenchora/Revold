-- ============================================================
-- Integration credentials table
-- Stores OAuth tokens for CRM integrations (HubSpot, Salesforce)
-- ============================================================

CREATE TABLE integrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  access_token    text NOT NULL,
  refresh_token   text,
  token_expires_at timestamptz,
  portal_id       text,
  metadata        jsonb DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON integrations FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_integrations_org ON integrations(organization_id);

-- Add quarterly_target to organizations for KPI computation
ALTER TABLE organizations ADD COLUMN quarterly_target numeric(15,2) DEFAULT 2000000;
