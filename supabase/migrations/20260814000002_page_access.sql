-- Accès par page et par équipe (Paramètres → Utilisateurs & équipes).
-- Une ligne par (org, page) : access = jsonb
--   { "sales": {"view":true,"edit":true,"create":false}, "marketing": {...}, ... }
-- Absence de ligne = accès par défaut des espaces de travail (WORKSPACE_NAV).
-- La « Visualisation » est appliquée à la navigation (sidebar) ; Modification
-- et Création sont stockées pour être appliquées aux flux d'édition/création.
-- Appliquée manuellement dans le SQL Editor.

create table if not exists page_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  page_href text not null,
  access jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id, page_href)
);

alter table page_access enable row level security;

drop policy if exists page_access_org on page_access;
create policy page_access_org on page_access
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_page_access on page_access (organization_id, page_href);
