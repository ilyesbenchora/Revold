-- SIRET de l'organisation (14 chiffres = SIREN + NIC). Identifiant Tier 1
-- utilisé pour le rapprochement cross-outils, à côté du SIREN déjà présent.
-- La récupération des données Pennylane passe par le token API du compte,
-- pas par cet identifiant.

alter table public.organizations
  add column if not exists siret text;
