-- Notification channels & preferences for Phase 8.4
-- Permet à chaque org de configurer email/Slack/Teams/webhook
-- + per-alert override des canaux à utiliser quand l'objectif est atteint

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE : notification_channels (org-level config)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists notification_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Type de canal
  type text not null check (type in ('email', 'slack', 'teams', 'webhook')),

  -- Configuration spécifique au canal :
  --   email   : { recipients: ["a@org.com", "b@org.com"] }
  --   slack   : { webhook_url: "https://hooks.slack.com/services/...", channel: "#sales" }
  --   teams   : { webhook_url: "https://outlook.office.com/webhook/..." }
  --   webhook : { url: "https://...", headers: {...}, secret: "..." }
  config jsonb not null default '{}',

  -- Activé pour cette org ?
  enabled boolean not null default true,

  -- Préférences digest
  digest_daily_enabled boolean not null default true,
  digest_daily_time time not null default '08:00:00',
  digest_weekly_enabled boolean not null default false,
  digest_weekly_day text not null default 'monday' check (
    digest_weekly_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une seule config par type par org
  constraint notification_channels_org_type_unique unique (organization_id, type)
);

create index if not exists idx_notification_channels_org on notification_channels(organization_id);
create index if not exists idx_notification_channels_enabled on notification_channels(organization_id, enabled);

-- ────────────────────────────────────────────────────────────────────────────
-- ALERTS : per-alert notification channels (jsonb array de types de canaux)
-- ────────────────────────────────────────────────────────────────────────────
alter table alerts add column if not exists notification_channels jsonb default '["in_app"]';

-- Exemple : ["in_app", "email", "slack"] = quand cette alerte hit son objectif,
-- envoyer via cloche in-app + email + Slack (canaux configurés au niveau org)

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE : notification_log (audit trail des envois)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel_type text not null check (channel_type in ('in_app', 'email', 'slack', 'teams', 'webhook')),

  -- Source de la notif
  source_type text not null check (source_type in ('alert_resolved', 'daily_digest', 'weekly_digest', 'coaching_critical', 'manual')),
  source_id uuid, -- alert_id ou coaching_id

  -- Status
  status text not null check (status in ('sent', 'failed', 'pending')),
  error text,

  -- Contenu pour debug
  recipient text, -- email ou webhook URL
  subject text,

  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_log_org on notification_log(organization_id, created_at desc);
create index if not exists idx_notification_log_source on notification_log(source_type, source_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policies
-- ────────────────────────────────────────────────────────────────────────────
alter table notification_channels enable row level security;
alter table notification_log enable row level security;

-- notification_channels : admin uniquement de l'org
create policy "Org members can read their notification channels"
  on notification_channels for select
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );

create policy "Org admins can manage their notification channels"
  on notification_channels for all
  using (
    organization_id in (
      select organization_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- notification_log : lecture seule pour les membres
create policy "Org members can read their notification log"
  on notification_log for select
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger : updated_at
-- ────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notification_channels_updated_at on notification_channels;
create trigger notification_channels_updated_at
  before update on notification_channels
  for each row execute function set_updated_at();
