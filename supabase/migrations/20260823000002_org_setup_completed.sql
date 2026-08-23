-- La modale « Bienvenue sur Revold » (OrgSetupModal) ne doit s'afficher qu'à
-- la PREMIÈRE connexion d'un nouveau compte. Déduire l'onboarding de champs
-- manquants (employees_range/industry) faisait resurgir la modale sur les
-- comptes EXISTANTS créés avant 20260818000003 : marqueur explicite,
-- backfillé à vrai pour toutes les orgs déjà créées — leur fiche peut rester
-- incomplète sans redéclencher la modale.

alter table organizations add column if not exists setup_completed boolean not null default false;
update organizations set setup_completed = true where setup_completed = false;
