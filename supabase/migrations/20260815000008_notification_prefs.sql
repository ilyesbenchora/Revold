-- Préférences de notification PAR ÉVÉNEMENT (Paramètres → Notifications) :
-- chaque événement (alerte en tension, radar de facturation, enrichissement
-- terminé, action exécutée…) choisit ses canaux. Miroir du « contenu du brief »
-- de la tour de contrôle, mais côté push.
-- Portée ORGANISATION : les crons (service role) doivent pouvoir les lire.
-- Appliquée manuellement dans le SQL Editor.

create table if not exists notification_event_prefs (
  organization_id uuid not null references organizations(id) on delete cascade,
  event_key       text not null,
  enabled         boolean not null default true,
  -- Canaux retenus pour cet événement : ["in_app","email","slack","sms","whatsapp"]
  channels        jsonb not null default '["in_app"]'::jsonb,
  updated_at      timestamptz default now(),
  primary key (organization_id, event_key)
);

alter table notification_event_prefs enable row level security;

drop policy if exists "tenant_isolation" on notification_event_prefs;
create policy "tenant_isolation" on notification_event_prefs
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

-- Numéro de mobile du compte : active les canaux SMS et WhatsApp sans autre
-- configuration (l'utilisateur le saisit dans Mon compte).
alter table profiles add column if not exists phone text;

comment on column profiles.phone is
  'Mobile au format international (+33...) - destinataire des canaux SMS et WhatsApp';
