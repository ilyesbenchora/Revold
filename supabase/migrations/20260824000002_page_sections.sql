-- Sections de page (en-têtes nommés, façon Notion) : l'utilisateur ajoute un
-- titre de section n'importe où sur une page de données (bouton flottant), sous
-- lequel se rangent ses rapports. `anchor` = index du bloc de haut niveau AVANT
-- lequel la section s'insère (0 = tout en haut, ≥ nombre de blocs = tout en bas).
create table if not exists page_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  page_key text not null,
  title text not null default 'Nouvelle section',
  anchor integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table page_sections enable row level security;

drop policy if exists page_sections_org on page_sections;
create policy page_sections_org on page_sections
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_page_sections on page_sections (organization_id, page_key);

comment on table page_sections is 'En-tetes de section ajoutes par l utilisateur sur les pages de donnees (facon Notion).';
