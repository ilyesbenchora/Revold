-- Ciblage par UTILISATEUR CRM étendu aux ENTREPRISES : les alertes techniques
-- des pages travaillant sur companies (Enrichissement, Données…) doivent
-- proposer le même ciblage par owner HubSpot que deals/contacts/tickets.
-- Appliquée automatiquement au build (scripts/migrate.mjs).

alter table companies add column if not exists hs_owner_id text;
create index if not exists idx_companies_org_hs_owner on companies (organization_id, hs_owner_id);

-- Backfill depuis raw_data pour les lignes déjà synchronisées (l'ETL demande
-- hubspot_owner_id sur les companies depuis l'origine).
update companies set hs_owner_id = raw_data->'properties'->>'hubspot_owner_id'
  where hs_owner_id is null and raw_data->'properties'->>'hubspot_owner_id' is not null;

comment on column companies.hs_owner_id is 'hubspot_owner_id de l entreprise — cle de filtrage par utilisateur CRM.';
