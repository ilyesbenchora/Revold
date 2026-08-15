-- Demandes RGPD (Paramètres → Sécurité) : suppression des données sur demande,
-- tracée avec horodatage et auteur. L'export, lui, est immédiat (téléchargement).

create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- deletion (seul type actuel — l'export ne crée pas de demande)
  kind text not null default 'deletion',
  -- pending | cancelled | done
  status text not null default 'pending',
  requested_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_data_requests_org on data_requests (organization_id, created_at desc);

alter table data_requests enable row level security;

drop policy if exists "data_requests_org" on data_requests;
create policy "data_requests_org" on data_requests
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );
