-- Outils sources choisis dans le funnel de création d'une table de données
-- (ex : {pennylane}). Réutilisés : tag sur la carte, pré-sélection à l'édition,
-- filtre primary_source au recalcul (/api/reports/recompute) et dans le cron
-- d'alertes (agg_spec.sources).
alter table public.page_data_tables
  add column if not exists sources text[] not null default '{}';
