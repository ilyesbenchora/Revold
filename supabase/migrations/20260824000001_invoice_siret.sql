-- Vue par ÉTABLISSEMENT (facette SIRET).
--
-- La résolution d'entité collapse le SIRET (14) en SIREN (9) : tous les
-- établissements d'une même entité légale deviennent UNE entreprise dans
-- Revold (consolidation voulue). Mais on perdait alors la vue par
-- établissement/club. On capture donc, SUR LA FACTURE, le SIRET reçu du
-- billing (Pennylane : SIRET du client), tel quel — sans changer la
-- résolution. Quand une entité légale a plusieurs SIRET sur ses factures, on
-- peut ventiler son CA par établissement (helper loadCompanyEstablishments).
alter table invoices add column if not exists siret text;

create index if not exists idx_invoices_siret
  on invoices(organization_id, company_id, siret)
  where siret is not null;
