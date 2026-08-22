# Audit des scopes OAuth — app HubSpot Revold (2026-08-22)

Source de vérité : `GET https://revold.ai/api/integrations/hubspot/debug/scopes`
(liste exacte demandée dans l'URL OAuth) croisée avec les appels réels du code
(`api.hubapi.com/**` dans lib/ et app/).

## Requis (4) — tous en lecture ✓
| Scope | Utilisé par |
|---|---|
| crm.objects.contacts.read | ETL contacts, recherches, KPIs |
| crm.objects.companies.read | ETL companies, enrichissement, réconciliation |
| crm.objects.deals.read | ETL deals, pipelines, KPIs ventes |
| crm.objects.owners.read | Attribution par commercial |

## Optionnels justifiés (échantillon des 45)
| Scope | Utilisé par |
|---|---|
| crm.objects.companies.write | Enrichissement (SIREN/SIRET/TVA écrits), fusions validées |
| crm.objects.contacts.write | Fusions de doublons validées fiche par fiche |
| crm.objects.deals.write | Actions deals (édition validée) |
| crm.schemas.*.read | Lecture des propriétés (mapping, audit complétude) |
| crm.objects.invoices.read / subscriptions.read | KPIs facturation/abonnements natifs HubSpot |
| automation / automation.sequences.* | Boîte Actions : inscription en séquence (Sales Pro+) |
| tickets / conversations.read | Pages Service client |
| settings.currencies.read / settings.users.read | Devises, licences |

## ⚠ À retirer avant soumission (non utilisés par le code)
- **`settings.billing.write`** — AUCUN appel dans le code ; un scope d'ÉCRITURE
  sur la facturation du portail est un drapeau rouge immédiat en review.
- À challenger aussi (aucun appel trouvé) : `crm.import`,
  `crm.dealsplits.read_write`, `external_integrations.forms.access`,
  `business_units_view.read`, `account-info.security.read`,
  `crm.objects.listings.read`, `crm.schemas.listings.read`,
  `crm.objects.appointments.read`, `crm.schemas.appointments.read`,
  `crm.objects.projects.read`.

## Procédure de retrait (coordonnée, sans casser l'existant)
1. Retirer les scopes de `HUBSPOT_OAUTH_OPTIONAL_SCOPES_DEFAULT`
   (lib/integrations/hubspot.ts) — ils sont « optionnels » : les portails déjà
   connectés ne sont pas impactés, seules les futures connexions demandent moins.
2. Aligner la configuration de l'app dans le dev portal HubSpot (Auth → scopes)
   sur la nouvelle liste — un écart URL ↔ portal fait échouer l'OAuth.
3. Tester une connexion complète sur un portail de test avant de soumettre.

## Rappels marketplace
- 3 installs actifs minimum (portails distincts, hors portail dev).
- Chaque scope de la fiche devra être justifié en une phrase (reprendre la
  colonne « Utilisé par » ci-dessus).
