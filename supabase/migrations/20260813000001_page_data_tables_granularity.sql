-- Fréquence d'affichage des dimensions temporelles d'une table de données
-- (day | week | month | quarter | semester | year — null = month).
-- Appliquée manuellement dans le SQL Editor.

alter table page_data_tables add column if not exists granularity text;
