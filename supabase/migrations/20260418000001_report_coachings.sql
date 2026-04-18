-- ============================================================
-- Report-driven AI coaching items
--
-- Each row represents an actionable "Coaching IA" derived from an activated
-- report. Created when the user clicks "Activer ce coaching" on a report
-- analysis block. Surfaced inside the matching /dashboard/insights-ia/<cat>
-- page, alongside auto-generated insights.
-- ============================================================

CREATE TABLE IF NOT EXISTS report_coachings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       uuid REFERENCES activated_reports(id) ON DELETE CASCADE,
  category        text NOT NULL, -- 'commercial' | 'marketing' | 'data' | 'integration' | 'cross-source' | 'data-model'
  team            text,
  kpi_label       text,
  title           text NOT NULL,
  body            text NOT NULL,
  recommendation  text,
  severity        text NOT NULL DEFAULT 'info',
  status          text NOT NULL DEFAULT 'active',
  source_report_title text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_coachings_org_cat
  ON report_coachings(organization_id, category, status);
CREATE INDEX IF NOT EXISTS idx_report_coachings_report
  ON report_coachings(report_id);

ALTER TABLE report_coachings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON report_coachings
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
