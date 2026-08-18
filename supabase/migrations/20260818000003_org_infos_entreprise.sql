-- Infos entreprise recueillies à l'inscription (flux « Continuer par email ») :
-- taille et secteur, rangées sur l'organisation pour être réutilisables dans
-- le compte (et par les agents).

alter table organizations add column if not exists employees_range text;
alter table organizations add column if not exists industry text;
