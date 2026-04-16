-- Add KPI tracking fields to alerts for real-time monitoring
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS forecast_type  text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS threshold      numeric;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS current_value  numeric;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS direction      text DEFAULT 'above'; -- 'above' = alert when value >= threshold, 'below' = alert when value <= threshold
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_checked   timestamptz;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_by     uuid REFERENCES auth.users(id);

-- Notifications table for in-app notifications (bell icon)
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  type            text NOT NULL DEFAULT 'alert_resolved', -- alert_resolved, alert_progress, system
  title           text NOT NULL,
  body            text,
  link            text, -- internal link to navigate to
  read            boolean DEFAULT false,
  alert_id        uuid REFERENCES alerts(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON notifications FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
