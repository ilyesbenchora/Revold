-- Évolution des tuiles KPI ajoutées : référence quotidienne stockée sur la
-- ligne (décalée dès qu'elle a plus de 24 h) — affichée ▲/▼ sous la valeur.
-- Appliquée manuellement dans le SQL Editor.

alter table page_tiles add column if not exists prev_value numeric;
alter table page_tiles add column if not exists prev_value_at timestamptz;
