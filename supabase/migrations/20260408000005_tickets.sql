-- ============================================================
-- Canonical tickets table
--
-- Receives data from support tools (Intercom, Zendesk, Crisp, Freshdesk).
-- Joins with contacts/companies via the canonical entity model so we can
-- compute churn risk insights cross-source.
-- ============================================================

CREATE TABLE tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  external_number text,                    -- ticket number from the source tool
  subject         text,
  status          text NOT NULL,           -- open, pending, resolved, closed
  priority        text,                    -- low, normal, high, urgent
  channel         text,                    -- email, chat, phone, web
  assignee_email  text,
  opened_at       timestamptz,
  resolved_at     timestamptz,
  first_response_at timestamptz,
  primary_source  text NOT NULL,           -- intercom, zendesk, crisp, freshdesk
  source_metadata jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_tickets_org ON tickets(organization_id);
CREATE INDEX idx_tickets_contact ON tickets(organization_id, contact_id);
CREATE INDEX idx_tickets_company ON tickets(organization_id, company_id);
CREATE INDEX idx_tickets_status ON tickets(organization_id, status);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON tickets FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
