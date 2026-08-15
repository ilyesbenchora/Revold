-- COACHING : passage d'une conversation à un PROGRAMME DE DÉVELOPPEMENT mesuré.
--
-- 1. coaching_styles      : le style du coach est paramétrable (ton, niveau de
--                           challenge, format de séance, consignes libres).
-- 2. development_plans    : objectif de DÉVELOPPEMENT (une compétence à
--                           acquérir), relié à un objectif business témoin
--                           (objectives.id) → le progrès est vérifiable sur les
--                           vraies données, pas auto-déclaré.
-- 3. development_steps    : les étapes datées du plan (les « next steps »).
-- 4. coaching_sessions    : satisfaction + thèmes de séance (onglet Insights).
-- 5. coaching_commitments : rattachement d'un engagement à une étape du plan.
-- Entièrement idempotent.

-- ── 1. Style de coaching, par coach et par organisation ──
create table if not exists coaching_styles (
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_key text not null,
  tone text not null default 'direct',
  challenge text not null default 'ferme',
  format text not null default 'structure',
  custom_instructions text,
  updated_at timestamptz not null default now(),
  primary key (organization_id, agent_key)
);
alter table coaching_styles enable row level security;
drop policy if exists "coaching_styles_tenant" on coaching_styles;
create policy "coaching_styles_tenant" on coaching_styles for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

-- ── 2. Plan de développement ──
create table if not exists development_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category text not null,
  agent_key text,
  -- Objectif business témoin : sert de PREUVE de progrès (facultatif).
  objective_id uuid references objectives(id) on delete set null,
  title text not null,
  why text,
  target_behavior text,
  start_date date not null default current_date,
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'paused', 'dropped')),
  baseline_value numeric,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table development_plans enable row level security;
drop policy if exists "development_plans_tenant" on development_plans;
create policy "development_plans_tenant" on development_plans for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()));
create index if not exists idx_development_plans_org on development_plans (organization_id, category, status);

-- ── 3. Étapes du plan ──
create table if not exists development_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references development_plans(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  position int not null default 0,
  title text not null,
  description text,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skipped')),
  completed_at timestamptz,
  evidence text,
  created_at timestamptz not null default now()
);
alter table development_steps enable row level security;
drop policy if exists "development_steps_tenant" on development_steps;
create policy "development_steps_tenant" on development_steps for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()));
create index if not exists idx_development_steps_plan on development_steps (plan_id, position);

-- ── 4. Séances : satisfaction + thèmes (onglet Insights) ──
alter table coaching_sessions add column if not exists rating smallint;
alter table coaching_sessions add column if not exists feedback text;
alter table coaching_sessions add column if not exists topics jsonb not null default '[]'::jsonb;
alter table coaching_sessions add column if not exists agent_key text;
alter table coaching_sessions add column if not exists plan_id uuid references development_plans(id) on delete set null;

-- ── 5. Engagements rattachés à une étape du plan ──
alter table coaching_commitments add column if not exists step_id uuid references development_steps(id) on delete set null;
