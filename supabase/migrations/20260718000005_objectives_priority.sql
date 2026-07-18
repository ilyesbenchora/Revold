-- Priorité d'un objectif (faible / moyen / urgent), alignée sur les alertes.
-- Appliquée manuellement dans le SQL Editor.

alter table objectives add column if not exists priority text default 'moyen';

comment on column objectives.priority is 'Priorite de l objectif : faible | moyen | urgent.';
