-- ============================================================
-- Revold — Initial Schema
-- Multi-tenant revenue intelligence platform
-- ============================================================

-- ORGANIZATIONS (tenants)
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  hubspot_portal_id text,
  salesforce_org_id text,
  plan            text NOT NULL DEFAULT 'trial',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- PROFILES (extends auth.users)
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  full_name       text NOT NULL,
  role            text NOT NULL DEFAULT 'member',
  avatar_url      text,
  created_at      timestamptz DEFAULT now()
);

-- PIPELINE STAGES (customizable per org)
CREATE TABLE pipeline_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  position        int NOT NULL,
  probability     numeric(5,2) NOT NULL DEFAULT 0,
  is_closed_won   boolean DEFAULT false,
  is_closed_lost  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- COMPANIES (accounts/prospects)
CREATE TABLE companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  domain          text,
  segment         text,
  industry        text,
  annual_revenue  numeric(15,2),
  employee_count  int,
  hubspot_id      text,
  salesforce_id   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- CONTACTS
CREATE TABLE contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  company_id      uuid REFERENCES companies(id),
  email           text NOT NULL,
  full_name       text NOT NULL,
  title           text,
  phone           text,
  is_mql          boolean DEFAULT false,
  is_sql          boolean DEFAULT false,
  hubspot_id      text,
  created_at      timestamptz DEFAULT now()
);

-- DEALS
CREATE TABLE deals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  company_id      uuid REFERENCES companies(id),
  owner_id        uuid REFERENCES profiles(id),
  stage_id        uuid REFERENCES pipeline_stages(id),
  name            text NOT NULL,
  amount          numeric(15,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'EUR',
  close_date      date,
  created_date    date NOT NULL DEFAULT CURRENT_DATE,
  days_in_stage   int DEFAULT 0,
  last_activity_at timestamptz,
  is_at_risk      boolean DEFAULT false,
  risk_reasons    jsonb DEFAULT '[]',
  win_probability numeric(5,4),
  hubspot_id      text,
  salesforce_id   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ACTIVITIES (calls, emails, meetings, notes)
CREATE TABLE activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id         uuid REFERENCES deals(id),
  contact_id      uuid REFERENCES contacts(id),
  owner_id        uuid REFERENCES profiles(id),
  type            text NOT NULL,
  subject         text,
  body            text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  duration_minutes int,
  created_at      timestamptz DEFAULT now()
);

-- KPI SNAPSHOTS (daily materialized metrics)
CREATE TABLE kpi_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  snapshot_date   date NOT NULL DEFAULT CURRENT_DATE,
  closing_rate    numeric(5,2),
  pipeline_coverage numeric(5,2),
  sales_cycle_days int,
  weighted_forecast numeric(15,2),
  mql_to_sql_rate numeric(5,2),
  inactive_deals_pct numeric(5,2),
  data_completeness numeric(5,2),
  deal_velocity   numeric(15,2),
  sales_score     int,
  marketing_score int,
  crm_ops_score   int,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, snapshot_date)
);

-- AI INSIGHTS
CREATE TABLE ai_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id         uuid REFERENCES deals(id),
  category        text NOT NULL,
  severity        text NOT NULL DEFAULT 'info',
  title           text NOT NULL,
  body            text NOT NULL,
  recommendation  text,
  is_dismissed    boolean DEFAULT false,
  generated_at    timestamptz DEFAULT now(),
  expires_at      timestamptz
);

-- SYNC LOGS
CREATE TABLE sync_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  source          text NOT NULL,
  direction       text NOT NULL,
  entity_type     text NOT NULL,
  entity_count    int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending',
  error_message   text,
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Organizations: members can view their org
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Tenant isolation policy for all data tables
CREATE POLICY "Tenant isolation" ON pipeline_stages FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON companies FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON contacts FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON deals FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON activities FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON kpi_snapshots FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON ai_insights FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation" ON sync_logs FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_pipeline_stages_org ON pipeline_stages(organization_id);
CREATE INDEX idx_companies_org ON companies(organization_id);
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_deals_org ON deals(organization_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_deals_at_risk ON deals(organization_id) WHERE is_at_risk = true;
CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_kpi_snapshots_org_date ON kpi_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX idx_ai_insights_org ON ai_insights(organization_id);
CREATE INDEX idx_ai_insights_deal ON ai_insights(deal_id);
CREATE INDEX idx_sync_logs_org ON sync_logs(organization_id);
