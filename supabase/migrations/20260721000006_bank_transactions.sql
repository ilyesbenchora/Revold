-- Transactions bancaires + comptes bancaires synchronisés depuis les outils
-- comptables (Pennylane API v2 /transactions et /bank_accounts).
--
-- Alimente les blocs Trésorerie même sans facture émise :
--   encaissements  = transactions montant > 0
--   décaissements  = transactions montant < 0
--   trésorerie disponible = somme des soldes réels des comptes bancaires

create table if not exists public.bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_source  text not null,             -- pennylane, ...
  external_id     text not null,             -- id transaction chez le provider
  label           text,
  amount          numeric(15,2) not null default 0,  -- signé : >0 encaissement, <0 décaissement
  fee             numeric(15,2) default 0,
  currency        text not null default 'EUR',
  date            timestamptz,
  bank_account_external_id text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (organization_id, primary_source, external_id)
);

create index if not exists idx_bank_tx_org_source
  on public.bank_transactions (organization_id, primary_source, date);

alter table public.bank_transactions enable row level security;
drop policy if exists "Tenant isolation" on public.bank_transactions;
create policy "Tenant isolation" on public.bank_transactions for all
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));

create table if not exists public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_source  text not null,
  external_id     text not null,
  name            text,
  currency        text not null default 'EUR',
  balance         numeric(15,2),              -- solde réel au moment de la sync
  synced_at       timestamptz default now(),
  created_at      timestamptz default now(),
  unique (organization_id, primary_source, external_id)
);

alter table public.bank_accounts enable row level security;
drop policy if exists "Tenant isolation" on public.bank_accounts;
create policy "Tenant isolation" on public.bank_accounts for all
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
