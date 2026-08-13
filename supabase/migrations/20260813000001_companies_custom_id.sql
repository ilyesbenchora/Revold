-- ID de rapprochement custom (code client interne, partagé CRM ↔ facturation).
-- Alimenté par : la sync HubSpot (propriété mappée sur « ID de rapprochement »
-- dans Paramètres → Modèle de données) et les connecteurs billing (Stripe,
-- Pennylane, Chargebee, GoCardless, Sage). Consommé par la règle de résolution
-- custom_id_match (match exact insensible à la casse, confiance 100 %).

alter table companies add column if not exists custom_id text;

create index if not exists idx_companies_org_custom_id
  on companies (organization_id, custom_id);
