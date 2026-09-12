-- Connecteurs sur-mesure : authentification OAuth2 « client credentials »
-- (flux serveur-à-serveur des ERP / API métier). Les paramètres (token_url,
-- client_id, client_secret, scope) vivent dans auth_config jsonb ; auth_type
-- passe alors à 'oauth2'. Appliquée automatiquement au build (migrate.mjs).

alter table custom_connectors add column if not exists auth_config jsonb;

comment on column custom_connectors.auth_config is 'Config OAuth2 client-credentials (token_url, client_id, client_secret, scope) quand auth_type = oauth2.';
