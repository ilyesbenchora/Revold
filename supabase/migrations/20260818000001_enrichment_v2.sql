-- Enrichissement v2 :
--  1. Trois nouveaux champs officiels sur companies — statut juridique
--     (nature_juridique Sirene), capital social (RNE/INPI, si publié) et
--     adresse du siège social (siege.adresse Sirene).
--  2. Table enrichment_runs : historique des passes d'enrichissement lancées
--     depuis la page Enrichissement (CTA « Enrichir mon CRM ») — date/heure,
--     champs couverts, compteurs, affichés sous le bloc moteur.

alter table companies add column if not exists legal_form text;
alter table companies add column if not exists share_capital numeric;
alter table companies add column if not exists head_office_address text;

comment on column companies.legal_form is 'Statut juridique officiel (libelle INSEE derive de nature_juridique Sirene).';
comment on column companies.share_capital is 'Capital social (RNE/INPI) — null quand non publie.';
comment on column companies.head_office_address is 'Adresse du siege social (registre Sirene).';

create table if not exists enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Champs couverts par la passe (ids EnrichmentFields : siren, siret, vat,
  -- employees, revenue, industry, legalForm, shareCapital, headOfficeAddress).
  fields jsonb not null default '[]'::jsonb,
  -- Périmètre de la passe au lancement (fiches à traiter) — la progression
  -- « repart à 0 » sur ce périmètre, pas sur la base entière.
  scope_total integer not null default 0,
  -- Compteurs de fin : { identities, facts, candidates, duplicates, crmPushed, crmFailed }.
  stats jsonb not null default '{}'::jsonb,
  status text not null default 'running' check (status in ('running', 'done', 'interrupted')),
  created_by uuid
);

create index if not exists enrichment_runs_org_idx on enrichment_runs (organization_id, started_at desc);

alter table enrichment_runs enable row level security;

drop policy if exists enrichment_runs_org on enrichment_runs;
create policy enrichment_runs_org on enrichment_runs
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
