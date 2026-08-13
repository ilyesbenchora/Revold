-- IDs de rapprochement multiples (CRM relié à plusieurs outils : un code
-- client interne différent peut être partagé avec chaque outil).
-- custom_id garde la première valeur (compat mono-ID, affichage) ;
-- custom_ids porte TOUTES les valeurs normalisées en minuscules — alimenté par
-- la sync HubSpot (propriétés mappées custom_id, custom_id_2…) et enrichi par
-- les connecteurs billing. Consommé par la règle custom_id_match (contains).

alter table companies add column if not exists custom_ids text[];

create index if not exists idx_companies_org_custom_ids
  on companies using gin (custom_ids);

-- Reprise de l'existant : les custom_id déjà posés rejoignent la liste.
update companies
  set custom_ids = array[lower(trim(custom_id))]
  where custom_id is not null
    and trim(custom_id) <> ''
    and custom_ids is null;
