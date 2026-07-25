-- Pipeline ciblé par une table de données (deals uniquement, nom ou id HubSpot).
-- Sans lui, groupBy=stage mélange les étapes homonymes de TOUS les pipelines
-- (ex : table « … dans le pipeline Storee retail » qui affichait les étapes en
-- double). Réutilisé par le recalcul ET les alertes posées sur la table.
alter table public.page_data_tables
  add column if not exists pipeline text;
