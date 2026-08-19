-- Rapports (tables de données) : option « masquer les filtres » à la
-- consultation — la barre de contrôles (période, fréquence, pipeline, détail)
-- se replie pour un rendu propre (projection, partage). true = visible (défaut).
-- Appliquée automatiquement au build (scripts/migrate.mjs).

alter table page_data_tables
  add column if not exists show_filters boolean not null default true;
