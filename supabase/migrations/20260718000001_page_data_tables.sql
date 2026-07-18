-- Tables de données construites par l'utilisateur sur les pages (façon Notion).
-- Chaque entrée = une visualisation persistée (entité + dimension + mesure).
-- Appliquée manuellement dans le SQL Editor.

create table if not exists page_data_tables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  page_key text not null,
  title text not null,
  entity text not null,
  group_by text not null,
  measure text not null default 'count',
  field text,
  unit_mode text,
  view text not null default 'table',
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table page_data_tables enable row level security;

drop policy if exists page_data_tables_org on page_data_tables;
create policy page_data_tables_org on page_data_tables
  for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create index if not exists idx_page_data_tables on page_data_tables (organization_id, page_key);

comment on table page_data_tables is 'Tables de donnees construites par l utilisateur sur les pages (visualisations persistees).';
