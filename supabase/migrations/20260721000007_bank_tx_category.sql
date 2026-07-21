-- Catégorie analytique d'une transaction bancaire (catégorisation Pennylane).
-- Permet la ventilation des charges/encaissements par poste dans les blocs
-- Trésorerie (top charges par catégorie, part non catégorisée).

alter table public.bank_transactions
  add column if not exists category text,
  add column if not exists category_group text;

create index if not exists idx_bank_tx_category
  on public.bank_transactions (organization_id, primary_source, category);
