-- Champs MÉTIER supplémentaires des connecteurs sur mesure (1b/1c du plan
-- « tableaux personnalisables ») :
-- 1) deals et bank_transactions gagnent source_metadata (invoices,
--    subscriptions et tickets l'ont déjà) — la sync custom y range les valeurs
--    des champs supplémentaires sous source_metadata.extra.<id>.
-- 2) custom_connector_endpoints porte la définition des champs supplémentaires
--    (extra_fields : [{ id, label, kind: number|label, source }]).
-- Le moteur d'agrégats accepte alors groupBy "extra.<id>" et field
-- "extra.<id>" — les KPIs du funnel se câblent sur les champs propres à l'ERP.

alter table deals add column if not exists source_metadata jsonb default '{}'::jsonb;
alter table bank_transactions add column if not exists source_metadata jsonb default '{}'::jsonb;

alter table custom_connector_endpoints add column if not exists extra_fields jsonb not null default '[]'::jsonb;

comment on column custom_connector_endpoints.extra_fields is 'Champs metier supplementaires [{id,label,kind,source}] — stockes a la sync dans source_metadata.extra.<id> des enregistrements.';
