-- Advanced alert filters for SMART KPI tracking
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS team           text; -- sales, marketing, cs, finance
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS pipeline_id    uuid;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS owner_filter   uuid; -- specific rep or null for all
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS date_from      date;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS date_to        date;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS date_preset    text; -- this_month, this_quarter, this_year, last_30d, last_90d, custom
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS unit_mode      text DEFAULT 'percent'; -- percent, value, count
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS segment_filter text; -- company segment filter
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity       text DEFAULT 'info'; -- info, warning, critical
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS frequency      text DEFAULT 'every_check'; -- every_check, daily, weekly
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS expires_at     timestamptz;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS min_deal_amount numeric; -- only count deals above this amount
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS deal_stage_filter text; -- specific stage name filter
