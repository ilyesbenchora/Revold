-- Sécurité & API : clés d'API Revold (lecture des données via /api/v1) et
-- webhooks sortants (événements POST JSON signés HMAC). La clé n'est jamais
-- stockée en clair : hash SHA-256 + préfixe d'affichage.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid,
  label text not null,
  key_prefix text not null,          -- « rvk_ab12… » affiché dans l'UI
  key_hash text not null unique,     -- sha256 hex de la clé complète
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists idx_api_keys_org on api_keys (organization_id, created_at desc);

alter table api_keys enable row level security;
drop policy if exists api_keys_org on api_keys;
create policy api_keys_org on api_keys
  for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()))
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid,
  url text not null,
  events text[] not null default '{}',
  secret text not null,              -- signature HMAC-SHA256 (header x-revold-signature)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_status integer
);
create index if not exists idx_webhooks_org on webhooks (organization_id, created_at desc);

alter table webhooks enable row level security;
drop policy if exists webhooks_org on webhooks;
create policy webhooks_org on webhooks
  for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()))
  with check (organization_id in (select organization_id from profiles where id = auth.uid()));
