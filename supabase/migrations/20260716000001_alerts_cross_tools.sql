-- Alertes : outils à croiser + second KPI attendu (multi-outils)
-- Appliquée manuellement dans le SQL Editor Supabase.

alter table alerts add column if not exists cross_sources jsonb;
alter table alerts add column if not exists threshold_secondary numeric;
alter table alerts add column if not exists unit_mode_secondary text;

comment on column alerts.cross_sources is 'Clés des outils connectés à croiser pour cette alerte (ex: ["hubspot","stripe"]).';
comment on column alerts.threshold_secondary is 'Second KPI attendu quand plusieurs outils sont croisés (un KPI par outil).';
comment on column alerts.unit_mode_secondary is 'Unité du second KPI: percent | count.';
