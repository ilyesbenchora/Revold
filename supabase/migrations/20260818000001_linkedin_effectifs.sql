-- Source LinkedIn (bêta) pour l'effectif : colonnes de résultat + marqueur de
-- scan sur companies. La donnée LinkedIn est stockée À CÔTÉ de la donnée
-- officielle (official_employee_range, URSSAF/INSEE) — jamais à sa place :
-- elle COMPLÈTE l'effectif quand le registre ne le publie pas.
-- Appliquée automatiquement au build (scripts/migrate.mjs).

alter table companies add column if not exists linkedin_employee_range text;
alter table companies add column if not exists linkedin_employee_count integer;
alter table companies add column if not exists linkedin_checked_at timestamptz;

comment on column companies.linkedin_employee_range is 'Tranche d effectif publiee sur la page LinkedIn de l entreprise (staffCountRange).';
comment on column companies.linkedin_employee_count is 'Point median de la tranche LinkedIn (usage KPI / push CRM).';
comment on column companies.linkedin_checked_at is 'Dernier scan LinkedIn (re-scan 30 j) — pose meme sans resultat pour ne jamais boucler.';
