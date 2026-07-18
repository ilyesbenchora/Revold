-- Rapprochement des objectifs manuels (ex : « 200 M€ d'ARR ») avec les vraies
-- données via une spec d'agrégat canonique, comme pour les alertes techniques.
-- Appliquée manuellement dans le SQL Editor.

alter table objectives add column if not exists agg_spec jsonb;
comment on column objectives.agg_spec is 'Spec agregat canonique { entity, groupBy, measure, field, target, multiplier } pour tracker l objectif sur les vraies donnees.';
