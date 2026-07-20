-- CORRECTIF — le mapping des étapes de pipeline ne s'écrivait jamais.
--
-- La migration 20260717000001 a créé un index unique PARTIEL :
--     create unique index … on pipeline_stages (organization_id, external_id)
--       where external_id is not null;
--
-- Postgres ne peut pas inférer un index partiel pour un `ON CONFLICT
-- (organization_id, external_id)` si l'ordre n'embarque pas la même clause
-- WHERE — ce que PostgREST n'émet pas. L'upsert de syncPipelineStages
-- échouait donc systématiquement en 42P10 ("there is no unique or exclusion
-- constraint matching the ON CONFLICT specification"), erreur avalée par le
-- `if (error) return {}` de lib/sync/hubspot-etl.ts. Résultat : external_id,
-- pipeline_external_id et pipeline_name restaient NULL, et deals.stage_id
-- n'était jamais lié.
--
-- Un index unique NON partiel convient : Postgres traite les NULL comme
-- distincts (pas de NULLS NOT DISTINCT ici), donc les lignes de seed sans
-- external_id restent autorisées, et l'inférence ON CONFLICT fonctionne.

drop index if exists idx_pipeline_stages_org_external;

create unique index if not exists idx_pipeline_stages_org_external
  on pipeline_stages (organization_id, external_id);

comment on index idx_pipeline_stages_org_external is
  'Cle de correspondance stage HubSpot par org. Non partiel : requis pour l inference ON CONFLICT de l upsert ETL.';
