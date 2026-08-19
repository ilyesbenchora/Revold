-- Rapports (tables de données) : filtre COHORTE persisté à la consultation —
-- le rapport tourne restreint aux entreprises de la cohorte choisie.
-- cohort_key ∈ { segment, industry } (colonnes canoniques companies) ;
-- cohort_value = bucket exact (« inconnu » = valeur null).
-- Appliquée automatiquement au build (scripts/migrate.mjs).

alter table page_data_tables
  add column if not exists cohort_key text,
  add column if not exists cohort_value text;
