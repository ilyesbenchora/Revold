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
  forecast_type text,
  target numeric,
  unit_mode text,
  direction text default 'above',
  current_value numeric,
  date_from date,
  date_to date,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table objectives enable row level security;

drop policy if exists objectives_org_all on objectives;
-- FOR ALL sans WITH CHECK : l'expression USING s'applique aussi aux écritures.
create policy objectives_org_all on objectives
  for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create index if not exists idx_objectives_org on objectives (organization_id, status);

comment on table objectives is 'Objectifs business (cap CEO/manager) avec cible, periode et completion.';
