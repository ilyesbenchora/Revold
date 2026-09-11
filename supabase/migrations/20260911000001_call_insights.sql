-- Conversations téléphoniques analysées (transcriptions Aircall AI) : les
-- MOTS-CLÉS business détectés (devis, facturation, prix, résiliation,
-- contrat…) rattachés à l'appel canonique (activities) et au contact CRM —
-- la « mine d'or » des conversations croisée avec le reste du modèle.
-- transcript_available=false = appel vérifié SANS transcription (add-on
-- Aircall AI absent ou appel trop court) : jamais re-testé en boucle.

create table if not exists public.call_insights (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  provider         text not null default 'aircall',
  external_call_id text not null,
  activity_id      uuid references public.activities(id) on delete cascade,
  contact_id       uuid references public.contacts(id) on delete set null,
  occurred_at      timestamptz,
  transcript_available boolean not null default false,
  keywords         text[] not null default '{}',
  snippet          text,
  created_at       timestamptz default now(),
  unique (organization_id, provider, external_call_id)
);

create index if not exists idx_call_insights_org_time
  on public.call_insights (organization_id, occurred_at desc);

alter table public.call_insights enable row level security;
drop policy if exists "Tenant isolation" on public.call_insights;
create policy "Tenant isolation" on public.call_insights for all
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
