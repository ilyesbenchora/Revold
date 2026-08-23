-- HIÉRARCHIE d'entreprises (consolidation groupe) : une entreprise peut avoir
-- une entreprise PARENT (le groupe / la tête de groupe). Alimenté par les
-- associations parent/enfant HubSpot (le client entretient déjà sa hiérarchie
-- dans son CRM) ou manuellement — jamais deviné par le nom. Permet la
-- réconciliation à deux niveaux : par entité ET consolidée groupe. Appliquée
-- au build.

alter table companies add column if not exists parent_company_id uuid references companies(id) on delete set null;
-- Provenance du rattachement : hubspot (association CRM) | manual | inpi.
alter table companies add column if not exists company_group_source text;

comment on column companies.parent_company_id is 'Entreprise parente (groupe) — hierarchie multi-entites, consolidation groupe.';
comment on column companies.company_group_source is 'Provenance du rattachement parent : hubspot | manual | inpi.';

create index if not exists idx_companies_parent on companies (organization_id, parent_company_id);
