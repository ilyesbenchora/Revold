-- Custom reports: store filters + team + mark as user-created
ALTER TABLE activated_reports ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;
ALTER TABLE activated_reports ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE activated_reports ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}'::jsonb;
