-- Lien deal → contact PRIMAIRE (associations HubSpot v4 deals→contacts).
-- Certains portails (ex : Storee) n'associent PAS les deals aux entreprises :
-- la chaîne réelle est deal → contact → entreprise du contact. Ce lien permet
-- 1) de remplir deals.company_id indirectement (via contacts.company_id), et
-- 2) d'appliquer les cohortes CONTACT directement aux tables de deals.

alter table deals add column if not exists contact_id uuid references contacts(id) on delete set null;
create index if not exists idx_deals_contact on deals (organization_id, contact_id);

comment on column deals.contact_id is 'Contact primaire du deal (association HubSpot) — rapprochement cohortes contact + liaison entreprise indirecte.';
