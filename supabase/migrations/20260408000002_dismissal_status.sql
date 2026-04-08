-- Add status to track if insight is "done" (réalisée) or "removed" (retirée)
ALTER TABLE insight_dismissals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';
