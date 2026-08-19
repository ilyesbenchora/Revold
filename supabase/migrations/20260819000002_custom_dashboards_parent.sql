-- Onglets (sous-pages) d'un tableau de bord : mêmes lignes custom_dashboards,
-- rattachées au tableau parent par parent_id. Un tableau racine a parent_id
-- null ; supprimer un tableau supprime ses onglets (cascade). La perso de
-- chaque onglet vit sous sa propre clé board_<id> (page_tiles / page_data_tables).
alter table custom_dashboards
  add column if not exists parent_id uuid references custom_dashboards(id) on delete cascade;

create index if not exists idx_custom_dashboards_parent on custom_dashboards (parent_id);
