-- Champs de profil d'organisation saisis dans Paramètres → Organisation
-- (devise, année fiscale, fuseau, pays, SIREN, TVA, secteur). Complète les
-- colonnes déjà présentes (name, slug, hubspot_portal_id, quarterly_target).

alter table public.organizations
  add column if not exists currency          text,
  add column if not exists fiscal_year_start integer,
  add column if not exists timezone          text,
  add column if not exists country           text,
  add column if not exists siren             text,
  add column if not exists vat               text,
  add column if not exists industry          text;
