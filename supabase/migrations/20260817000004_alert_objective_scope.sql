-- Portée d'une alerte / d'un objectif : « personal » (mon suivi) ou « team »
-- (partagé avec l'équipe de l'espace de travail). Affichée en badge sur les
-- cartes, choisie à la création. Appliquée manuellement dans le SQL Editor.

alter table alerts add column if not exists scope text not null default 'personal';
alter table objectives add column if not exists scope text not null default 'personal';

comment on column alerts.scope is 'personal | team — portee de l alerte (badge sur la carte).';
comment on column objectives.scope is 'personal | team — portee de l objectif (badge sur la carte).';
