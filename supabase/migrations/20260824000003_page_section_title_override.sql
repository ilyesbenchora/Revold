-- Renommage des sections DÉJÀ EN PLACE (titres codés en dur : Marge, CA…).
-- Réutilise page_sections : une ligne avec `section_key` non nul = un OVERRIDE
-- de titre pour un en-tête existant (repéré par une clé stable dérivée de son
-- libellé d'origine), title = le nouveau nom. Les lignes section_key NULL
-- restent les sections AJOUTÉES (anchor). Unicité par (org, page, section_key).
alter table page_sections add column if not exists section_key text;

create unique index if not exists uq_page_sections_override
  on page_sections (organization_id, page_key, section_key)
  where section_key is not null;
