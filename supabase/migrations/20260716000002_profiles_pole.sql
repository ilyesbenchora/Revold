-- POC espaces de travail : pôle métier d'un membre (sales | marketing | cs | finance).
-- NULL = pas de pôle (accès global, typiquement admin). Appliquée manuellement.

alter table profiles add column if not exists pole text;

comment on column profiles.pole is 'Pôle métier du membre pour les espaces de travail : sales | marketing | cs | finance. NULL = accès global.';
