-- Boîte de réception d'ACTIONS (Suivi → Actions) : les actions à exécuter
-- dans les outils (tâche HubSpot, relance Stripe…), proposées par les
-- détecteurs déterministes de Revold ou par les agents, et validées ou
-- refusées par l'utilisateur (human-in-the-loop). L'exécution est tracée.

create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- hubspot_task | stripe_send_invoice
  type text not null,
  -- pending | executed | rejected | failed
  status text not null default 'pending',
  title text not null,
  description text,
  -- detector:silent_deal | detector:overdue_invoice | agent:<agentKey>
  source text not null default 'detector',
  -- Clé d'unicité métier : un même constat ne crée jamais deux actions.
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);

create unique index if not exists idx_action_items_dedupe
  on action_items (organization_id, dedupe_key);
create index if not exists idx_action_items_org_status
  on action_items (organization_id, status, created_at desc);

alter table action_items enable row level security;

drop policy if exists "action_items_org" on action_items;
create policy "action_items_org" on action_items
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
