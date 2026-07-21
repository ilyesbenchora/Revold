-- Sens du flux d'une facture canonique :
--   'in'  = facture client (encaissement)   — défaut, toutes les lignes existantes
--   'out' = facture fournisseur (décaissement) — synchronisée depuis Pennylane
-- Alimente les blocs Trésorerie (balance, charges fixes, runway).

alter table public.invoices
  add column if not exists direction text not null default 'in';

create index if not exists idx_invoices_direction
  on public.invoices (organization_id, direction, status);
