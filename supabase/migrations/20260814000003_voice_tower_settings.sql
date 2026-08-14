-- Réglages de la tour de contrôle vocale, rattachés au COMPTE utilisateur
-- (synchronisés entre appareils) : toggles par fonctionnalité + phrase de
-- brief personnalisée, stockés en JSON.
create table if not exists voice_tower_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table voice_tower_settings enable row level security;

-- Chaque utilisateur ne voit et ne modifie que sa propre ligne.
create policy "voice_tower_settings_select_own"
  on voice_tower_settings for select
  using (auth.uid() = user_id);

create policy "voice_tower_settings_insert_own"
  on voice_tower_settings for insert
  with check (auth.uid() = user_id);

create policy "voice_tower_settings_update_own"
  on voice_tower_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
