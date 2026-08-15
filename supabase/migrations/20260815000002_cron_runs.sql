-- Monitoring des crons : chaque exécution est journalisée (statut, durée,
-- résumé, erreur). RLS activée SANS policy = lisible/inscriptible uniquement
-- par le service role (wrapper monitoredCron + endpoint /api/cron/health).
-- Un cron qui échoue en silence = données périmées sans que personne ne le
-- sache — cette table rend l'échec visible.
CREATE TABLE IF NOT EXISTS cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron text NOT NULL,
  status text NOT NULL DEFAULT 'running', -- running | ok | failed
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  detail jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_cron_date ON cron_runs (cron, started_at DESC);
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
