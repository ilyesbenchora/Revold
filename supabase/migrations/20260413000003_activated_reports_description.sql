-- Add description and expected_value to activated_reports
ALTER TABLE activated_reports ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE activated_reports ADD COLUMN IF NOT EXISTS expected_value text DEFAULT '';
