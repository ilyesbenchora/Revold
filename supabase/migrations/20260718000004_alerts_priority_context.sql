-- Funnel de création d'alerte v2 :
--  - priority       : priorité choisie (faible / moyen / urgent)
--  - continuous     : surveillance en continu (sans borne de dates)
--  - user_context   : description libre transmise à l'agent pour rapprocher les vraies données
--  - secondary_kpis : un KPI par source croisée (ex : CRM + Stripe pour la finance)
-- Appliquée manuellement dans le SQL Editor.

alter table alerts add column if not exists priority text default 'moyen';
alter table alerts add column if not exists continuous boolean default false;
alter table alerts add column if not exists user_context text;
alter table alerts add column if not exists secondary_kpis jsonb;

comment on column alerts.priority is 'Priorite de l alerte : faible | moyen | urgent.';
comment on column alerts.continuous is 'Vrai si l alerte surveille le KPI en continu (pas de borne de dates).';
comment on column alerts.user_context is 'Description libre fournie par l utilisateur, utilisee par l agent pour creer/affiner l alerte.';
comment on column alerts.secondary_kpis is 'KPI par source croisee : [{ source, value, unit_mode }].';
