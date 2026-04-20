-- Phase 8.7 — Conversation Intelligence (Praiz integration)
-- Stocke les transcriptions, insights et scoring AI des appels commerciaux
-- récupérés via webhook Praiz.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  provider text not null default 'praiz' check (provider in ('praiz', 'modjo', 'gong', 'manual')),
  provider_id text not null,

  title text,
  source text,
  duration_seconds integer,
  recorded_at timestamptz,
  recording_url text,
  transcript_url text,
  user_email text,

  participants jsonb not null default '[]',
  insights jsonb not null default '{}',
  scores jsonb not null default '{}',

  hubspot_contact_id text,
  hubspot_deal_id text,
  hubspot_company_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint conversations_provider_id_unique unique (organization_id, provider, provider_id)
);

create index if not exists idx_conversations_org on conversations(organization_id, recorded_at desc);
create index if not exists idx_conversations_user on conversations(organization_id, user_email);
create index if not exists idx_conversations_hubspot_deal on conversations(organization_id, hubspot_deal_id) where hubspot_deal_id is not null;
create index if not exists idx_conversations_hubspot_contact on conversations(organization_id, hubspot_contact_id) where hubspot_contact_id is not null;

alter table conversations enable row level security;

create policy "Org members can read their conversations"
  on conversations for select
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );

create policy "Service role can manage all conversations"
  on conversations for all
  using (auth.jwt() ->> 'role' = 'service_role');

drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();
