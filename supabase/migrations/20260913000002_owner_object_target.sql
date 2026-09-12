-- Objet sur lequel le propriétaire (owner_filter) est indexé : 'deals',
-- 'contacts' ou 'companies'. Rend le ciblage par utilisateur CRM explicite et
-- garantit un câblage vérifié. Appliquée automatiquement au build (migrate.mjs).

alter table alerts     add column if not exists owner_object text;
alter table objectives add column if not exists owner_object text;

comment on column alerts.owner_object     is 'Objet du proprietaire filtre (deals | contacts | companies) — filtre dur sur cet objet.';
comment on column objectives.owner_object is 'Objet du proprietaire filtre (deals | contacts | companies) — filtre dur sur cet objet.';
