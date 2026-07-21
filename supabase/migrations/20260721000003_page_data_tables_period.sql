-- Période par défaut d'une table de données (choisie à l'étape « Affichage » du
-- funnel). Le graphique s'ouvre directement sur cette période ; l'utilisateur
-- peut toujours la changer ensuite via la barre de période. Valeurs = ids des
-- presets de lib/reports/periods.ts (all, this_month, qtd, ytd, ...).
-- Appliquée manuellement dans le SQL Editor.

alter table page_data_tables add column if not exists period_preset text default 'all';

comment on column page_data_tables.period_preset is 'Periode par defaut (preset de lib/reports/periods.ts) appliquee a l ouverture de la table.';
