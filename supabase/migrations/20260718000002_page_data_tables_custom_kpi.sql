-- Mémorise le KPI personnalisé (texte libre) ayant servi à générer la table via
-- l'agent, afin de pouvoir le réécrire plus tard et laisser l'agent peaufiner.
-- Appliquée manuellement dans le SQL Editor.

alter table page_data_tables add column if not exists custom_kpi text;

comment on column page_data_tables.custom_kpi is 'KPI personnalise (texte) source, si la table a ete generee via l agent. NULL pour un preset.';
