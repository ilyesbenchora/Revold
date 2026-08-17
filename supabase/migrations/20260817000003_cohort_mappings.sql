-- Cohortes (Paramètres → Cohortes) : mapping des propriétés CRM qui portent
-- les axes marketing — souvent des propriétés CUSTOM selon les bases.
-- mappings jsonb = [{ key, label, internal_name, api_name }, ...] avec les
-- sections standard (industry, segment, source, priority) + customs ajoutées.
-- Sert à croiser correctement ces axes dans les reportings.
-- Appliquée manuellement dans le SQL Editor.

create table if not exists cohort_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  mappings jsonb not null default '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table cohort_mappings enable row level security;

drop policy if exists cohort_mappings_org on cohort_mappings;
create policy cohort_mappings_org on cohort_mappings
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
