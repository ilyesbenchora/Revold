-- Personnalisation des blocs de pages (tuiles KPI + blocs métier) façon Notion.
-- kind = 'kpi'        → tuile KPI ajoutée par l'utilisateur (forecast_type OU agg_spec)
-- kind = 'hide_tile'  → tuile par défaut masquée (tile_key = clé stable de la tuile en dur)
-- kind = 'hide_block' → bloc par défaut masqué (tile_key = clé stable du bloc en dur)
-- Appliquée manuellement dans le SQL Editor.

create table if not exists page_tiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  page_key text not null,
  kind text not null default 'kpi' check (kind in ('kpi', 'hide_tile', 'hide_block')),
  tile_key text,
  title text,
  forecast_type text,
  agg_spec jsonb,
  unit_mode text,
  position int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table page_tiles enable row level security;

drop policy if exists page_tiles_org on page_tiles;
create policy page_tiles_org on page_tiles
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_page_tiles on page_tiles (organization_id, page_key);

-- Un même masquage ne peut pas être enregistré deux fois.
create unique index if not exists idx_page_tiles_hide_unique
  on page_tiles (organization_id, page_key, kind, tile_key)
  where tile_key is not null;

comment on table page_tiles is 'Personnalisation des blocs de pages : tuiles KPI ajoutees et tuiles/blocs par defaut masques.';
