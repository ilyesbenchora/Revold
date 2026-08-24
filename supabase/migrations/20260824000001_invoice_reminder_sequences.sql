-- Relances d'impayés par EMAIL avec séquence automatique (bloc « Relances &
-- cash récupéré », page Trésorerie).
--
-- Une séquence par facture : premier envoi validé à la main depuis la modale,
-- renvois automatiques par cron (recurrence_days) tant que la facture n'est
-- pas payée, jusqu'au plafond max_sends. Arrêt immédiat dès paiement détecté.
-- Chaque séquence garde son invoice_reminders (créé au 1er envoi) : c'est lui
-- qui porte l'attribution déterministe du cash récupéré — inchangée.

create table if not exists invoice_reminder_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  reminder_id uuid references invoice_reminders(id) on delete set null,
  recipient_email text not null,
  reply_to text,
  subject text not null,
  body text not null,
  -- null ou 0 = pas de récurrence (envoi unique).
  recurrence_days int,
  max_sends int not null default 3,
  sends_count int not null default 0,
  last_sent_at timestamptz,
  -- null = plus rien à envoyer (séquence terminée ou sans récurrence).
  next_send_at timestamptz,
  stopped_at timestamptz,
  -- paid | max_reached | manual
  stop_reason text,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_id)
);

create index if not exists idx_reminder_sequences_due
  on invoice_reminder_sequences (next_send_at)
  where next_send_at is not null and stopped_at is null;

alter table invoice_reminder_sequences enable row level security;

drop policy if exists "invoice_reminder_sequences_org" on invoice_reminder_sequences;
create policy "invoice_reminder_sequences_org" on invoice_reminder_sequences
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
