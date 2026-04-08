-- Snapshot insight content directly in dismissals so any insight (library or
-- automation) can be displayed in sub-pages without depending on a library.
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS recommendation text;
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS severity text DEFAULT 'info';
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS category text DEFAULT 'commercial';
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS hubspot_url text;
