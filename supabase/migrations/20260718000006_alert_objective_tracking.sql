-- Rapprochement KPI ↔ données réelles pour les alertes techniques (tables) et
-- le suivi des objectifs.
--   alerts.agg_spec  : spec d'agrégat canonique { entity, groupBy, measure, field, target }
--                      permettant au cron de calculer la VRAIE valeur d'une alerte
--                      technique (forecast_type null) et de détecter l'atteinte du seuil.
--   objectives.resolved_at : horodatage d'atteinte (évite les notifications en double).
--   objectives.last_checked : dernier calcul de la valeur réelle.
-- Appliquée manuellement dans le SQL Editor.

alter table alerts add column if not exists agg_spec jsonb;
comment on column alerts.agg_spec is 'Spec agregat canonique { entity, groupBy, measure, field, target } pour tracker une alerte technique/table sur les vraies donnees.';

alter table objectives add column if not exists resolved_at timestamptz;
alter table objectives add column if not exists last_checked timestamptz;
comment on column objectives.resolved_at is 'Horodatage d atteinte de l objectif (une seule notification).';
