-- Navigation personnalisable des sous-pages (onglets) : renommage des onglets
-- standard + pages custom ajoutées par l'utilisateur (ex : page Ventes).
-- items jsonb = [{ slug, label, custom }] — slug "" = onglet racine ;
-- custom = true → page rendue sur /p/[slug] (tuiles KPI + tableaux
-- configurables via page_tiles / page_tables, clé perf_<nav>_<slug>).
-- Appliquée automatiquement au build (scripts/migrate.mjs).

create table if not exists page_nav (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nav_key text not null,
  items jsonb not null default '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id, nav_key)
);

alter table page_nav enable row level security;

drop policy if exists page_nav_org on page_nav;
create policy page_nav_org on page_nav
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
