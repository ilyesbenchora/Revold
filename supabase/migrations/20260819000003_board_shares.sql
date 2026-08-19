-- Partage PUBLIC en lecture seule d'un tableau de bord : un lien /partage/<id>
-- (id = jeton non devinable) rend le tableau (tuiles + tables recalculées)
-- sans authentification. L'id du partage EST le secret ; révoquer = supprimer
-- la ligne. Un seul lien par page (org, page_key) — recréer après révocation
-- génère un NOUVEAU jeton (l'ancien lien meurt).

create table if not exists board_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Clé de la page partagée : 'tableau_bord' (Vue d'ensemble) ou 'board_<id>'.
  page_key text not null,
  -- Titre affiché sur la page publique (figé au partage).
  title text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, page_key)
);

alter table board_shares enable row level security;

-- Gestion réservée aux membres de l'org ; la LECTURE publique passe par le
-- service role côté serveur (jamais par le client anonyme).
drop policy if exists board_shares_org on board_shares;
create policy board_shares_org on board_shares
  for all
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_board_shares_page on board_shares (organization_id, page_key);

comment on table board_shares is 'Liens publics lecture seule des tableaux de bord — id = jeton du lien /partage/<id>.';
