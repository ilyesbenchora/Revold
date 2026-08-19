-- Dictionnaire SÉMANTIQUE des métriques de l'organisation (Paramètres →
-- Métriques) : chaque métrique porte le nom et la DÉFINITION maison
-- (« CA signé = deals gagnés hors renouvellements, pipeline France »).
-- Consommé par TOUS les agents (chat, tableaux conversationnels, câblage des
-- KPIs personnalisés) : tout le monde parle du même chiffre.

create table if not exists metric_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Nom de la métrique tel qu'employé dans l'entreprise (« CA signé », « MRR net »).
  label text not null,
  -- Définition maison : périmètre, exclusions, pipeline/source de référence.
  definition text not null,
  -- Unité d'affichage attendue (currency | percent | count) — optionnelle.
  unit text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table metric_definitions enable row level security;

drop policy if exists metric_definitions_org on metric_definitions;
create policy metric_definitions_org on metric_definitions
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_metric_definitions on metric_definitions (organization_id, created_at);

comment on table metric_definitions is 'Dictionnaire des metriques de l org — definitions maison injectees dans les agents.';
