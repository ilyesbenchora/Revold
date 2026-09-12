-- Ciblage des alertes et objectifs par UTILISATEUR CRM (owner HubSpot), en
-- plus de l'équipe : le moteur filtre deals/contacts par hubspot_owner_id.
-- Appliquée automatiquement au build (scripts/migrate.mjs).

-- 1) Owner HubSpot sur les entités filtrables (l'ETL le remplit désormais ;
--    backfill depuis raw_data pour les lignes déjà synchronisées).
alter table deals    add column if not exists hs_owner_id text;
alter table contacts add column if not exists hs_owner_id text;
create index if not exists idx_deals_org_hs_owner    on deals (organization_id, hs_owner_id);
create index if not exists idx_contacts_org_hs_owner on contacts (organization_id, hs_owner_id);

update deals set hs_owner_id = raw_data->'properties'->>'hubspot_owner_id'
  where hs_owner_id is null and raw_data->'properties'->>'hubspot_owner_id' is not null;
update contacts set hs_owner_id = raw_data->'properties'->>'hubspot_owner_id'
  where hs_owner_id is null and raw_data->'properties'->>'hubspot_owner_id' is not null;

-- 2) alerts.owner_filter était uuid (inutilisable : les ids owners HubSpot
--    sont numériques) → text. owner_name pour l'affichage sur les cartes.
alter table alerts alter column owner_filter type text using owner_filter::text;
alter table alerts add column if not exists owner_name text;

-- 3) Objectifs : même ciblage par utilisateur CRM.
alter table objectives add column if not exists owner_filter text;
alter table objectives add column if not exists owner_name text;

comment on column deals.hs_owner_id      is 'hubspot_owner_id du deal — cle de filtrage par utilisateur CRM.';
comment on column contacts.hs_owner_id   is 'hubspot_owner_id du contact — cle de filtrage par utilisateur CRM.';
comment on column alerts.owner_filter    is 'Id owner HubSpot cible (text) — alerte indexee sur un utilisateur CRM.';
comment on column alerts.owner_name      is 'Nom de l utilisateur CRM cible (affichage carte).';
comment on column objectives.owner_filter is 'Id owner HubSpot cible (text) — objectif indexe sur un utilisateur CRM.';
comment on column objectives.owner_name  is 'Nom de l utilisateur CRM cible (affichage carte).';
