-- Dates de contrat mappées depuis le CRM (propriétés custom — le nom diffère
-- chez chaque client, mapping dans Paramètres → Modèle de données). Multi-objet :
-- la date peut vivre sur la Company ET/OU le Deal. Alimente le radar de
-- facturation Trésorerie. Appliquée manuellement dans le SQL Editor.

alter table companies add column if not exists contract_start date;
alter table companies add column if not exists contract_end date;
alter table deals add column if not exists contract_start date;
alter table deals add column if not exists contract_end date;

create index if not exists idx_companies_contract_end
  on companies (organization_id, contract_end) where contract_end is not null;
create index if not exists idx_deals_contract_end
  on deals (organization_id, contract_end) where contract_end is not null;

comment on column companies.contract_start is 'Date de debut de contrat (propriete CRM mappee)';
comment on column companies.contract_end is 'Date de fin de contrat (propriete CRM mappee) - radar de facturation';
comment on column deals.contract_start is 'Date de debut de contrat portee par le deal (propriete CRM mappee)';
comment on column deals.contract_end is 'Date de fin de contrat portee par le deal (propriete CRM mappee)';
