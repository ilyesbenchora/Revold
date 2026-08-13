-- Réorganisation par drag & drop (mode « Personnaliser les KPIs ») :
-- 1) page_tiles accepte kind='tile_order' — UNE ligne par page qui porte
--    l'ordre de TOUTES les tuiles (défaut + ajoutées) dans agg_spec.order,
--    tile_key = '__order__' (satisfait l'index unique partiel existant).
-- 2) page_data_tables.position — ordre d'affichage des tables de données.
-- Appliquée manuellement dans le SQL Editor.

alter table page_tiles drop constraint if exists page_tiles_kind_check;
alter table page_tiles add constraint page_tiles_kind_check
  check (kind in ('kpi', 'hide_tile', 'hide_block', 'tile_order'));

alter table page_data_tables add column if not exists position int;

comment on column page_data_tables.position is 'Ordre d affichage de la table sur sa page (drag & drop, null = ordre de creation).';
