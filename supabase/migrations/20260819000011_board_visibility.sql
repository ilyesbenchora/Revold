-- Visibilité des tableaux de bord et de leurs onglets :
--   'private'   → visible uniquement par son créateur (et les admins) ;
--   'team'      → visible par l'équipe (pôle) portée par la colonne team ;
--   'workspace' → visible par toute l'organisation (défaut = comportement actuel).
-- Les lignes existantes restent en 'workspace' : rien ne disparaît pour personne.

alter table custom_dashboards add column if not exists visibility text not null default 'workspace';
alter table custom_dashboards drop constraint if exists custom_dashboards_visibility_check;
alter table custom_dashboards add constraint custom_dashboards_visibility_check
  check (visibility in ('private', 'team', 'workspace'));

-- Équipe (espace de travail : sales / marketing / cs / finance) quand
-- visibility = 'team' — posée depuis le pôle de celui qui fait le choix.
alter table custom_dashboards add column if not exists team text;

comment on column custom_dashboards.visibility is 'private (createur seul) | team (pole de la colonne team) | workspace (toute l organisation)';
