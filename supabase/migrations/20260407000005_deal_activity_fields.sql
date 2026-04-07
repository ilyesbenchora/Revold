-- Add activity tracking fields to deals (from HubSpot native properties)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS next_activity_date timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_activities_count int DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS days_to_close int;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS forecast_amount numeric(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS associated_contacts_count int DEFAULT 0;
