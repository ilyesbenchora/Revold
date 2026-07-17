-- Objectifs (séparés des alertes) : cap fixé par un CEO/manager avec cible,
-- période, et suivi de complétion. Appliquée manuellement dans le SQL Editor.

create table if not exists objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  impact text,
  category text,
  team text,
  owner_id uuid,
  forecast_type text,          -- KPI auto-tracké (optionnel), sinon current_value manuel
  target numeric,              -- valeur cible
  unit_mode text,              -- percent | currency | count
  direction text default 'above', -- above (monter) | below (descendre)
  current_value numeric,       -- valeur manuelle si pas de forecast_type
  date_from date,
  date_to date,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table objectives enable row level security;

drop policy if exists objectives_org_all on objectives;
create policy objectives_org_all on objectives
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_objectives_org on objectives (organization_id, status);

comment on table objectives is 'Objectifs business (cap CEO/manager) avec cible, période et complétion.';
