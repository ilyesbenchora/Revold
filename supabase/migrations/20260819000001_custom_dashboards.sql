-- Tableaux de bord personnalisés (Dashboard → Tableaux de bord) : pages créées
-- par l'utilisateur, entièrement configurables. Chaque tableau expose la clé
-- « board_<id> » utilisée par page_tiles (tuiles KPI), page_data_tables
-- (tables de données) et tool_mappings (outil source par page) — aucune autre
-- table nécessaire, toute la personnalisation vit dans l'infra existante.

create table if not exists custom_dashboards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table custom_dashboards enable row level security;

drop policy if exists custom_dashboards_org on custom_dashboards;
create policy custom_dashboards_org on custom_dashboards
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_custom_dashboards on custom_dashboards (organization_id, created_at);

comment on table custom_dashboards is 'Tableaux de bord crees par l utilisateur — la personnalisation (tuiles, tables, sources) vit sous la cle board_<id>.';
