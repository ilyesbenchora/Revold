-- RATTRAPAGE de 20260814000003_voice_tower_settings.sql
--
-- Cette migration existait AVANT la mise en place du runner automatique
-- (scripts/migrate.mjs, 15/08) : au premier run, la baseline l'a marquée
-- « appliquée » sans l'exécuter. Si la table n'a pas été créée à la main
-- entre-temps, elle manque en base. Ce fichier est entièrement idempotent :
-- il ne fait rien si tout est déjà en place.
create table if not exists voice_tower_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table voice_tower_settings enable row level security;

-- Chaque utilisateur ne voit et ne modifie que sa propre ligne.
drop policy if exists "voice_tower_settings_select_own" on voice_tower_settings;
create policy "voice_tower_settings_select_own"
  on voice_tower_settings for select
  using (auth.uid() = user_id);

drop policy if exists "voice_tower_settings_insert_own" on voice_tower_settings;
create policy "voice_tower_settings_insert_own"
  on voice_tower_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "voice_tower_settings_update_own" on voice_tower_settings;
create policy "voice_tower_settings_update_own"
  on voice_tower_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
