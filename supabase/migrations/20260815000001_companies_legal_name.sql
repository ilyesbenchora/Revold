-- Raison sociale officielle (base Sirene) : « l'entreprise à facturer ».
-- Alimentée par l'enrichissement Sirene (validation utilisateur), distincte du
-- nom commercial CRM (companies.name) qui n'est jamais écrasé.

alter table companies add column if not exists legal_name text;
