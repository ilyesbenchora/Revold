-- Échéances fiscales (TVA · IS · URSSAF) configurées par organisation.
-- Alimente la table de données « Échéances fiscales » du funnel Trésorerie
-- (page audit_paiement_facturation) via /api/fiscal/echeances.
-- Saisie dans Paramètres → Organisation → « Fiscalité & échéances ».

alter table public.organizations
  add column if not exists fiscal_tva_periodicite    text,
  add column if not exists fiscal_tva_prochaine       date,
  add column if not exists fiscal_tva_montant         numeric,
  add column if not exists fiscal_is_periodicite       text,
  add column if not exists fiscal_is_prochaine         date,
  add column if not exists fiscal_is_montant           numeric,
  add column if not exists fiscal_urssaf_periodicite   text,
  add column if not exists fiscal_urssaf_prochaine     date,
  add column if not exists fiscal_urssaf_montant       numeric;
