-- Enrichissement OPT-IN : le moteur (backfill, accélérateur de fond, cron) ne
-- tourne plus tant que l'utilisateur n'a pas cliqué « Enrichir mon CRM » au
-- moins une fois — activated_at est posé au premier clic. Une org sans ligne
-- enrichment_settings (ou sans activated_at) n'est JAMAIS enrichie d'office.
-- Appliquée automatiquement au build (scripts/migrate.mjs).

alter table enrichment_settings
  add column if not exists activated_at timestamptz;
