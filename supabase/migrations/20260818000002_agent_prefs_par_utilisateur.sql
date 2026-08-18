-- Paramètres → Agents : les préférences (ton, personnalité, insights) sont
-- PROPRES À CHAQUE UTILISATEUR, plus partagées par toute l'organisation.
-- Les réglages existants suivent leur auteur (updated_by).

alter table agent_prefs add column if not exists user_id uuid references auth.users(id) on delete cascade;

update agent_prefs set user_id = updated_by where user_id is null and updated_by is not null;
delete from agent_prefs where user_id is null;

alter table agent_prefs alter column user_id set not null;

-- Unicité par utilisateur (remplace l'unicité par organisation).
alter table agent_prefs drop constraint if exists agent_prefs_organization_id_agent_key_key;
create unique index if not exists uq_agent_prefs_user on agent_prefs (organization_id, user_id, agent_key);
drop index if exists idx_agent_prefs;

-- RLS : chacun ne lit et n'écrit que SES préférences.
drop policy if exists agent_prefs_org on agent_prefs;
drop policy if exists agent_prefs_user on agent_prefs;
create policy agent_prefs_user on agent_prefs
  for all
  using (
    user_id = auth.uid()
    and organization_id in (select organization_id from profiles where id = auth.uid())
  ) with check (
    user_id = auth.uid()
    and organization_id in (select organization_id from profiles where id = auth.uid())
  );
