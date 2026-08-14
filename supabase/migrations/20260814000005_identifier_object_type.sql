-- Objet CRM porteur de chaque champ mappé (Mapping des identifiants) :
-- l'utilisateur choisit l'objet (contacts / companies / deals) — la
-- vérification des propriétés et la collecte se font sur le bon objet sans
-- démultiplier les lignes du formulaire. NULL = objet par défaut du catalogue.
-- Appliquée manuellement dans le SQL Editor.

alter table identifier_field_mapping
  add column if not exists object_type text
  check (object_type is null or object_type in ('contacts', 'companies', 'deals'));

comment on column identifier_field_mapping.object_type is
  'Objet CRM porteur du champ (contacts/companies/deals) - null = defaut catalogue';
