-- Réglages d'enrichissement (Paramètres → Enrichissement) :
--  - fields : quels champs enrichir { employees, revenue, siren, siret, vat, industry }
--    (défaut : tout activé). La règle « JAMAIS écraser une donnée existante du
--    CRM » est toujours active (le moteur ne remplit que les champs vides).
--  - hubspot_search_ids : pousser SIREN/SIRET/TVA dans les fiches HubSpot →
--    entreprises retrouvables par ces numéros dans la barre de recherche HubSpot.
--  - linkedin_enabled : source LinkedIn (bêta) pour l'effectif.
-- + colonnes secteur d'activité sur companies (code NAF + libellé de section).
-- Appliquée manuellement dans le SQL Editor.

create table if not exists enrichment_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  fields jsonb not null default '{}'::jsonb,
  hubspot_search_ids boolean not null default true,
  linkedin_enabled boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table enrichment_settings enable row level security;

drop policy if exists enrichment_settings_org on enrichment_settings;
create policy enrichment_settings_org on enrichment_settings
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

-- Secteur d'activité officiel (registre Sirene) : code NAF + libellé de section.
alter table companies add column if not exists naf_code text;
alter table companies add column if not exists activity_label text;

comment on column companies.naf_code is 'Code NAF/APE officiel (activite_principale du registre Sirene).';
comment on column companies.activity_label is 'Libelle de la section d activite (INSEE) derive du code NAF.';
