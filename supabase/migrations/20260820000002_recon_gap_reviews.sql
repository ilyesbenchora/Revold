-- File d'APUREMENT des écarts de réconciliation (page Trésorerie) : chaque
-- entreprise en écart CA signé ↔ facturé porte un statut de traitement —
-- open (à traiter), justified (écart légitime : avoir, échéancier, remise…),
-- to_fix (à corriger dans les outils), fixed (corrigé). Avec note libre.
-- C'est le dossier que l'on montre à l'expert-comptable : mesuré, statué, tracé.

create table if not exists recon_gap_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'justified', 'to_fix', 'fixed')),
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id)
);

alter table recon_gap_reviews enable row level security;

drop policy if exists recon_gap_reviews_org on recon_gap_reviews;
create policy recon_gap_reviews_org on recon_gap_reviews
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_recon_gap_reviews on recon_gap_reviews (organization_id, status);

comment on table recon_gap_reviews is 'Statut d apurement des ecarts CRM vs facture par entreprise (justifie / a corriger / corrige).';
