-- Marketing-specific alert filters
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS lifecycle_stage text; -- filter contacts by lifecycle stage
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_filters  text[]; -- filter by hs_analytics_source values
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS custom_property  text; -- custom contact property name to filter on
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS custom_prop_value text; -- value to match for the custom property
