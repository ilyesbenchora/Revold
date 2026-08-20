-- Lien deal ↔ factures : la réconciliation passe du niveau ENTREPRISE au
-- niveau DEAL. Chaque facture peut être rattachée au deal gagné qu'elle
-- facture (proposé par le moteur de matching montant/date/société, confirmé
-- par l'utilisateur — ou lié automatiquement quand la correspondance est
-- exacte et unique). L'écart par deal (montant signé − facturé lié) devient
-- mesurable, alertable et exportable.

alter table invoices
  add column if not exists deal_id uuid references deals(id) on delete set null;

-- Méthode de rattachement (traçabilité) : auto_exact | manual.
alter table invoices
  add column if not exists deal_link_method text;

create index if not exists idx_invoices_deal on invoices (deal_id);
