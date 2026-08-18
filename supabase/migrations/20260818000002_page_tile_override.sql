-- page_tiles accepte kind='tile_override' — personnalisation d'une tuile PAR
-- DÉFAUT (Personnaliser les KPIs → ✎) : title = titre affiché à la place du
-- libellé en dur, agg_spec.sub = description affichée sous la valeur.
-- UNE ligne par tuile (index unique organization_id/page_key/kind/tile_key
-- existant) — upsert manuel côté API, suppression = retour au libellé d'origine.

alter table page_tiles drop constraint if exists page_tiles_kind_check;
alter table page_tiles add constraint page_tiles_kind_check
  check (kind in ('kpi', 'hide_tile', 'hide_block', 'tile_order', 'tile_override'));
