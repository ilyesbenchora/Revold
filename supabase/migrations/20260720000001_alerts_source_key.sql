-- Rattachement d'une alerte à la table de données qui l'a créée, pour pouvoir
-- afficher sur chaque table le nombre d'alertes posées dessus et un lien direct.
-- Clé stable dérivée du titre + sous-titre du bloc (cf. blockSourceKey côté UI).
alter table alerts add column if not exists source_key text;

create index if not exists idx_alerts_org_source_key
  on alerts (organization_id, source_key)
  where source_key is not null;

comment on column alerts.source_key is
  'Table/bloc de données d''origine de l''alerte chirurgicale. Null = alerte créée hors table.';
