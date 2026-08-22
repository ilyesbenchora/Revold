-- FIX INSCRIPTION : organizations n'avait qu'une policy SELECT — l'INSERT du
-- bootstrap (getOrgId crée org + profil au premier accès) était refusé par la
-- RLS pour tout NOUVEAU compte → « Aucune organisation configurée » partout.
-- Trois policies :
--  - INSERT : un utilisateur authentifié SANS profil (= nouveau compte) peut
--    créer son organisation — un membre existant ne peut pas en créer d'autres.
--  - UPDATE : les admins de l'org peuvent la modifier (nom, effectif, secteur —
--    formulaire d'onboarding et Paramètres → Général ; échouait aussi avant).
--  - DELETE : uniquement les orgs ORPHELINES (aucun profil) — le nettoyage
--    anti-course de getOrgId.
-- Appliquée automatiquement au build (scripts/migrate.mjs).

drop policy if exists "New users can create their organization" on organizations;
create policy "New users can create their organization"
  on organizations for insert
  with check (
    auth.uid() is not null
    and not exists (select 1 from profiles where id = auth.uid())
  );

drop policy if exists "Admins can update their organization" on organizations;
create policy "Admins can update their organization"
  on organizations for update
  using (
    id in (select organization_id from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Orphan organizations can be cleaned up" on organizations;
create policy "Orphan organizations can be cleaned up"
  on organizations for delete
  using (
    auth.uid() is not null
    and not exists (select 1 from profiles where organization_id = organizations.id)
  );
