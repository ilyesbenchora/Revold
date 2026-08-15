-- Rapports enregistrés : rattachement à une page de la plateforme.
--
-- Un rapport « libre » (créé depuis un chat d'agent) vit dans Dashboard →
-- Mes rapports. Quand l'utilisateur l'affecte à une page (Ventes, Marketing,
-- Trésorerie…), page_key mémorise ce rattachement : le rapport quitte la liste
-- des rapports libres et ses blocs câblés sont convertis en tables de la page.
alter table saved_reports add column if not exists page_key text;

create index if not exists idx_saved_reports_page
  on saved_reports (organization_id, page_key)
  where page_key is not null;
