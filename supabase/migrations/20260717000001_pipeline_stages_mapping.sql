-- Table de correspondance RÉELLE des étapes de pipeline (plus de résolution
-- devinée) : on enrichit pipeline_stages avec l'id externe HubSpot pour lier
-- deals.stage_id de façon fiable. Appliquée manuellement dans le SQL Editor.

alter table pipeline_stages add column if not exists external_id text;
alter table pipeline_stages add column if not exists pipeline_external_id text;
alter table pipeline_stages add column if not exists pipeline_name text;

-- Clé de correspondance : un stage HubSpot (external_id) par org.
create unique index if not exists idx_pipeline_stages_org_external
  on pipeline_stages (organization_id, external_id)
  where external_id is not null;

comment on column pipeline_stages.external_id is 'ID d''étape HubSpot (dealstage) — clé de correspondance réelle, jamais devinée.';
comment on column pipeline_stages.pipeline_external_id is 'ID de pipeline HubSpot parent.';
comment on column pipeline_stages.pipeline_name is 'Nom du pipeline HubSpot parent.';
