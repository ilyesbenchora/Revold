-- ============================================================
-- Revold canonical entity model
--
-- Step 1 of the multi-source revenue intelligence platform:
--   • source_links  → maps any provider's external IDs to internal Revold rows
--   • invoices      → canonical billing records (Stripe, Pennylane, Sellsy…)
--   • subscriptions → canonical recurring revenue (MRR/ARR)
--   • payments      → canonical charges (success / fail / refund)
--
-- Existing companies / contacts / deals tables stay in place and become
-- the canonical contacts/companies/deals (HubSpot already populates them).
-- ============================================================

-- ── Source links ──────────────────────────────────────────────────
CREATE TABLE source_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL,           -- hubspot, stripe, pipedrive, intercom...
  external_id     text NOT NULL,
  entity_type     text NOT NULL,           -- contact, company, deal, invoice, subscription, payment, ticket
  internal_id     uuid NOT NULL,
  match_method    text,                    -- exact_email, domain, fuzzy_name, manual, created
  match_score     numeric(3,2),            -- 0.00 → 1.00
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider, external_id, entity_type)
);

CREATE INDEX idx_source_links_internal ON source_links(organization_id, entity_type, internal_id);
CREATE INDEX idx_source_links_lookup ON source_links(organization_id, provider, entity_type);

ALTER TABLE source_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON source_links FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ── Invoices ──────────────────────────────────────────────────────
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  deal_id         uuid REFERENCES deals(id) ON DELETE SET NULL,
  number          text,
  status          text NOT NULL,           -- draft, open, paid, void, uncollectible
  currency        text NOT NULL DEFAULT 'EUR',
  amount_total    numeric(15,2) NOT NULL DEFAULT 0,
  amount_paid     numeric(15,2) NOT NULL DEFAULT 0,
  amount_due      numeric(15,2) NOT NULL DEFAULT 0,
  issued_at       timestamptz,
  due_at          timestamptz,
  paid_at         timestamptz,
  primary_source  text NOT NULL,           -- stripe, pennylane, ...
  source_metadata jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_contact ON invoices(organization_id, contact_id);
CREATE INDEX idx_invoices_company ON invoices(organization_id, company_id);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_paid_at ON invoices(organization_id, paid_at);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON invoices FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ── Subscriptions ─────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id            uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id            uuid REFERENCES companies(id) ON DELETE SET NULL,
  status                text NOT NULL,     -- active, trialing, past_due, canceled, ...
  currency              text NOT NULL DEFAULT 'EUR',
  mrr                   numeric(15,2) NOT NULL DEFAULT 0,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  started_at            timestamptz,
  canceled_at           timestamptz,
  primary_source        text NOT NULL,
  source_metadata       jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(organization_id, status);
CREATE INDEX idx_subscriptions_contact ON subscriptions(organization_id, contact_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON subscriptions FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ── Payments / charges ────────────────────────────────────────────
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  status          text NOT NULL,           -- succeeded, failed, refunded, pending
  amount          numeric(15,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'EUR',
  paid_at         timestamptz,
  failure_reason  text,
  primary_source  text NOT NULL,
  source_metadata jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON payments FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
