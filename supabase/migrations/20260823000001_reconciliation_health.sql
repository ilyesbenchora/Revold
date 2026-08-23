-- Santé de RÉCONCILIATION historisée (P2) : un instantané par org et par jour,
-- calculé par le cron compute-reconciliation-health. Transforme la
-- réconciliation d'un constat à la demande en CONTRÔLE surveillé dans le temps
-- (tendance du % réconcilié, de l'écart, des fuites). Appliquée au build.

create table if not exists reconciliation_health (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Un instantané par jour (les re-runs du jour mettent à jour la ligne).
  day date not null default (now() at time zone 'utc')::date,
  computed_at timestamptz not null default now(),
  -- Score composite 0..100 (deal→facture, facture→paiement, multi-source).
  score smallint not null default 0,
  -- Lignage deal → facture.
  won_deals int not null default 0,
  deal_solde int not null default 0,
  deal_gap_net numeric not null default 0,   -- Σ (signé − facturé) sur deals liés (se compense)
  deal_gap_gross numeric not null default 0, -- Σ |écart par deal| (RÉVÈLE la compensation)
  deal_leak_total numeric not null default 0,-- deals gagnés sans facture candidate
  -- Lignage facture → paiement.
  invoices int not null default 0,
  invoice_solde int not null default 0,
  due_total numeric not null default 0,
  unmatched_payments_total numeric not null default 0,
  -- Résolution d'entité.
  multi_source_pct smallint not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id, day)
);

alter table reconciliation_health enable row level security;

drop policy if exists reconciliation_health_org on reconciliation_health;
create policy reconciliation_health_org on reconciliation_health
  for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()))
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create index if not exists idx_reconciliation_health_org_day
  on reconciliation_health (organization_id, day desc);
