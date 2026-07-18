-- Ajoute une description libre à la table de données : précisions données par
-- l'utilisateur pour aider l'agent à mieux interpréter le KPI personnalisé.
-- Appliquée manuellement dans le SQL Editor.

alter table page_data_tables add column if not exists description text;

comment on column page_data_tables.description is 'Description libre (contexte / details) fournie par l utilisateur pour affiner l interpretation du KPI par l agent.';
