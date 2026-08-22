# Fiche App Marketplace HubSpot — Revold

> Textes prêts à coller dans le dev portal (App Marketplace → Create listing).
> Captures : ce dossier (01→06, 1600×1000 PNG, fond de marque sombre).
> Guide d'installation public : https://revold.ai/docs/hubspot
> Logo app : public/hubspot-app-logo.png

## App name
Revold — Revenue Intelligence

## Tagline (EN, ≤ ~90 caractères)
French-first revenue intelligence: reconcile HubSpot with billing data via SIREN/VAT and pilot revenue with AI.

## Description courte (EN)
Revold connects HubSpot to your billing, banking and support tools and reconciles every record through official French identifiers (SIREN, SIRET, VAT). You get verified cross-source KPIs, automatic CRM enrichment from government registries (Sirene/INPI), churn & cash-flow alerts, and a team of AI agents that answer questions on your real, reconciled numbers.

## Description longue (EN)
**Why Revold?**
Your CRM says one number, your invoicing tool says another. Revold ends the debate: every company in HubSpot is matched to its invoices and payments through official French identifiers (SIREN, SIRET, intra-EU VAT), so every KPI is verifiable down to the source record.

**What you get**
- **Automatic CRM enrichment** — SIREN, SIRET, VAT number, official headcount, revenue, legal form and registered address, fetched from the French state registry (Sirene/INPI) and written to HubSpot without overwriting your data. Runs continuously.
- **Verified cross-source reporting** — pipeline, closing rate, signed vs invoiced revenue, MRR: each KPI shows its source tool and live computed value.
- **Signed ↔ invoiced reconciliation** — deal-level gap detection with a clearance queue you can export for your accountant.
- **AI agent team** — sales, cash-flow, support and data agents that answer in plain language, on deterministic computations only (the AI never invents a number).
- **Alerts & objectives** — thresholds checked on live data, notified where you work (email, Slack, WhatsApp).

**Security & privacy**
Official HubSpot OAuth (no API keys), read-only by default, every write validated by you. Data hosted in the EU (Frankfurt database, Paris processing). GDPR-first: DPA available, deletion on request, access revocable anytime from either side.

## Description courte (FR)
Revold connecte HubSpot à vos outils de facturation, banque et support, et rapproche chaque fiche par les identifiants officiels français (SIREN, SIRET, TVA). KPIs cross-source vérifiés, enrichissement automatique du CRM depuis le registre de l'État (Sirene/INPI), alertes churn & trésorerie, et une équipe d'agents IA qui répond sur vos chiffres réels.

## Catégories suggérées
- Analytics & Data / Reporting
- Data Quality / Data Sync

## Langues
Français (interface), documentation FR — EN à venir.

## URLs de la fiche
- Setup guide: https://revold.ai/docs/hubspot
- Support: https://revold.ai/contact (réponse < 24 h ouvrées)
- Privacy policy: https://revold.ai/legal/confidentialite
- Terms of service: https://revold.ai/legal/cgu
- Pricing: https://revold.ai/tarifs

## Ordre des captures (avec légendes EN)
1. `01-dashboard.png` — "Your revenue cockpit: KPIs, AI team and voice control tower."
2. `02-performances-ventes.png` — "Sales performance on real data: signed revenue, weighted pipeline, closing rate, per-pipeline breakdown."
3. `03-enrichissement-sirene.png` — "Continuous CRM enrichment from the official French registry: SIREN, SIRET, VAT, headcount, revenue."
4. `04-hubspot-oauth-connecte.png` — "Official OAuth connection — your HubSpot data mirrored live, revocable anytime."
5. `05-modele-donnees.png` — "You control the data model: identifier mapping and resolution rules."
6. `06-equipe-ia.png` — "An AI expert team, 24/7, answering only from deterministic computations."

## Points de vigilance pour la review HubSpot
- **3 installs actifs minimum** sur des portails distincts avant soumission (le portail dev ne compte pas).
- Scopes : voir `scopes-audit.md` — retirer `settings.billing.write` (inutilisé) et vérifier l'alignement dev portal ↔ URL OAuth avant la soumission.
- Le flux de désinstallation doit être propre (tokens supprimés) — déjà géré par « Déconnecter ».
