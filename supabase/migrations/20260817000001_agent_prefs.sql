-- Préférences par agent (Paramètres → Agents) : personnalité et ton injectés
-- dans le system prompt de l'agent, + activation des « insights agent »
-- (sujets les plus abordés, profondeur des échanges) sur la page Paramètres.
-- Appliquée manuellement dans le SQL Editor.

create table if not exists agent_prefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_key text not null,
  -- Ton de l'agent : default | direct | pedagogue | challenger | chaleureux
  tone text,
  -- Consignes libres de personnalité (ajoutées au system prompt).
  personality text,
  -- Active le bloc « insights agent » dans Paramètres → Agents.
  insights_enabled boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_key)
);

alter table agent_prefs enable row level security;

drop policy if exists agent_prefs_org on agent_prefs;
create policy agent_prefs_org on agent_prefs
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_agent_prefs on agent_prefs (organization_id, agent_key);
