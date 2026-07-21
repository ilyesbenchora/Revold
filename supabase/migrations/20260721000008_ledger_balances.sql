-- Balance comptable reconstruite depuis les lignes d'écritures Pennylane
-- (ledger_entry_lines, agrégées par compte × mois à la synchronisation).
--
-- L'endpoint officiel trial_balance est interdit (403) pour les clés API
-- entreprise — on reconstruit la balance nous-mêmes, ce qui alimente :
--   - le P&L réel : produits (comptes 7) − charges (comptes 6) = résultat
--   - la marge comptable et le top des comptes de charges
--   - la balance générale synthétique par classe de comptes

create table if not exists public.ledger_balances (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_source  text not null,             -- pennylane, ...
  account_number  text not null,             -- numéro PCG complet (ex : 706000)
  account_label   text,
  month           date not null,             -- 1er jour du mois de l'écriture
  debit           numeric(15,2) not null default 0,
  credit          numeric(15,2) not null default 0,
  updated_at      timestamptz default now(),
  unique (organization_id, primary_source, account_number, month)
);

create index if not exists idx_ledger_balances_org
  on public.ledger_balances (organization_id, primary_source, account_number);

alter table public.ledger_balances enable row level security;
drop policy if exists "Tenant isolation" on public.ledger_balances;
create policy "Tenant isolation" on public.ledger_balances for all
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
