-- Option d'affichage par table de données : montrer le total DANS la
-- visualisation (badge sur les graphiques barres/courbe, centre de l'anneau,
-- ligne « Total » en pied de tableau) — pas seulement sous le titre.
alter table public.page_data_tables
  add column if not exists show_total boolean not null default false;
