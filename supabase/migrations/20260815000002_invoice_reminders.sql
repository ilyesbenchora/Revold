-- Module ROI « cash récupéré » : suivi des relances d'impayés.
-- Une ligne par relance de facture ; quand la facture passe payée (détection
-- déterministe au chargement du bloc), le montant relancé est attribué en
-- « cash récupéré » — le chiffre qui justifie l'abonnement Revold.

create table if not exists invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  reminded_at timestamptz not null default now(),
  -- Reste dû au moment de la relance : la base du montant récupéré.
  amount_due_at_reminder numeric,
  channel text not null default 'manual',
  -- Renseignés quand la facture est constatée payée après relance.
  recovered_at timestamptz,
  recovered_amount numeric,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_reminders_org on invoice_reminders (organization_id, reminded_at desc);
create index if not exists idx_invoice_reminders_invoice on invoice_reminders (organization_id, invoice_id);

alter table invoice_reminders enable row level security;

drop policy if exists "invoice_reminders_org" on invoice_reminders;
create policy "invoice_reminders_org" on invoice_reminders
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
