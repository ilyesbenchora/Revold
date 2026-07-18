-- Moteur de réconciliation (Phase 2) : recette de réconciliation cross-source
-- rattachée à une alerte / un objectif (jointure ligne-à-ligne sur company_id).
--   recon_spec = { recipe: "crm_vs_billed_gap" | "revenue_leakage" | "arr_reconciled" | ... }
-- Appliquée manuellement dans le SQL Editor.

alter table alerts add column if not exists recon_spec jsonb;
alter table objectives add column if not exists recon_spec jsonb;

comment on column alerts.recon_spec is 'Recette de reconciliation cross-source { recipe } calculee par jointure reelle (company_id).';
comment on column objectives.recon_spec is 'Recette de reconciliation cross-source { recipe } calculee par jointure reelle (company_id).';
