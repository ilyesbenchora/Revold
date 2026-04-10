# Roadmap Revold

> **Dernière mise à jour** : 2026-04-10
> **Statut global** : Phase 6 — Revenue Intelligence Platform (multi-source canonical model live, 13 connecteurs, insights cross-source)
> Ce fichier est mis à jour après chaque session de travail.

---

## Diagnostic Express

- **Stade actuel** : Revenue Intelligence SaaS fonctionnel (CRM + billing + support + 13 connecteurs)
- **Note architecture** : 8/10
- **Positionnement** : Plateforme d'intelligence revenue, marché B2B français
- **Différenciateurs** : French-native, multi-source canonical data model, SIREN-based entity resolution, AI-native scoring, insights cross-source impossibles avec un seul outil

---

## Modèle de Données Cible (Supabase)

```
organizations     — Tenants (name, slug, plan, hubspot_portal_id, quarterly_target)
profiles          — Users étendant auth.users (organization_id, role, full_name)
pipeline_stages   — Étapes customisables par org (name, position, probability, is_closed_won/lost)
companies         — Comptes (segment, industry, domain, siren, siret, vat_number, linkedin_url, country_code)
contacts          — Personnes (email, company_id, is_mql, is_sql, linkedin_url, secondary_email)
deals             — Opportunités (amount, stage_id, owner_id, close_date, win_probability, is_at_risk)
activities        — Interactions (type: email/call/meeting/note, deal_id, contact_id, occurred_at)
kpi_snapshots     — Métriques quotidiennes matérialisées (14 KPIs + 3 scores moteur)
ai_insights       — Insights générés (category, severity, title, body, recommendation)
sync_logs         — Journal de synchronisation (source, direction, status, entity_count)
integrations      — Tokens OAuth/API pour les outils connectés directement à Revold
source_links      — Mapping multi-source (provider, external_id → entity_type, internal_id, match_method)
invoices          — Factures canoniques (Stripe, Pennylane, Sellsy, Axonaut, QuickBooks)
subscriptions     — Abonnements / MRR (Stripe, Pennylane)
payments          — Paiements / charges (Stripe)
tickets           — Tickets support (Zendesk, Intercom, Freshdesk, Crisp)
insight_dismissals — Insights marqués fait/retiré avec snapshot contenu
alerts            — Alertes RevOps (category, severity, status)
```

RLS sur chaque table via `organization_id` pour isolation tenant.

---

## Phase 1 : Fondations ✅

| # | Tâche | Statut |
|---|---|---|
| 1.1 | Auth Supabase (email/password + magic link) | [x] |
| 1.2 | Middleware (token refresh + redirect edge-level) | [x] |
| 1.3 | Schéma DB (toutes les tables) | [x] |
| 1.4 | Seed data démo | [x] |
| 1.5 | Validation env avec zod | [x] |
| 1.6 | Error/loading boundaries | [x] |
| 1.7 | Setup tests (Vitest) | [x] |
| 1.8 | Dev tooling (Prettier, husky, lint-staged) | [x] |

---

## Phase 2 : Features Core ✅

| # | Tâche | Statut |
|---|---|---|
| 2.1 | Dashboard connecté aux KPIs | [x] |
| 2.2 | Pages Pipeline, Deals à Risque, Insights IA, Paramètres | [x] |
| 2.3 | Sidebar active state | [x] |
| 2.4 | Moteur de calcul KPI (cron quotidien) | [x] |
| 2.5 | Charting (recharts) | [x] |

---

## Phase 3 : Couche Intelligence ✅

| # | Tâche | Statut |
|---|---|---|
| 3.1 | Détection de risque rule-based | [x] |
| 3.2 | Moteur de scoring (formules pondérées) | [x] |
| 3.3 | Génération d'insights via Claude API | [x] |
| 3.4 | Modèle de forecast | [x] |
| 3.5 | Deal coaching | [x] |

---

## Phase 4 : Intégrations CRM ✅

| # | Tâche | Statut |
|---|---|---|
| 4.1 | HubSpot private app token + sync engine | [x] |
| 4.2 | Sync companies/contacts/deals + monitoring | [x] |
| 4.3 | Détection intégrations métier HubSpot (property groups, sources, engagements, portal apps, workflow webhooks, audit logs Enterprise) | [x] |
| 4.4 | Score d'intégration canonique et déterministe | [x] |

---

## Phase 5 : Multi-source canonical model ✅

| # | Tâche | Statut |
|---|---|---|
| 5.1 | Tables canoniques (source_links, invoices, subscriptions, payments, tickets) | [x] |
| 5.2 | Entity resolution engine (email, SIREN, VAT, domain, LinkedIn, external ID) | [x] |
| 5.3 | Generic sync framework (SourceConnector interface + registry) | [x] |
| 5.4 | 13 connecteurs (Stripe, Pipedrive, Salesforce, Zoho, monday, Pennylane, Sellsy, Axonaut, QuickBooks, Intercom, Zendesk, Crisp, Freshdesk) | [x] |
| 5.5 | Cross-source insights (6 insights HubSpot × Stripe × Pipedrive) | [x] |
| 5.6 | Insight IA Data Model (audit CRM + blueprint règles de résolution) | [x] |

---

## Phase 6 : Revenue Intelligence Platform (en cours)

| # | Tâche | Statut |
|---|---|---|
| 6.1 | Page Performances avec 4 sous-pages (Commerciale, Marketing, Paiement, Service Client) | [x] |
| 6.2 | Pipeline analytics HubSpot (multi-pipeline, vélocité par étape, audit attractivité) | [x] |
| 6.3 | Page Rapports avec 3 sous-pages (Mes rapports, Intégration unique, Intégrations multiples) | [x] |
| 6.4 | Page Paramètres complète (Général, Intégrations, Modèle de données, Notifications, Sécurité & API) | [x] |
| 6.5 | Identifiants uniques d'entreprise (SIREN, SIRET, TVA, LinkedIn) + migration DB | [x] |
| 6.6 | Règles de résolution avancées (9 rules configurables + external ID mapping + auto-writeback) | [x] |
| 6.7 | Alerte dropdown dans le header (cloche + popover) | [x] |
| 6.8 | Logo Revold redesign (gradient fuchsia→indigo + accent croissance) | [x] |
| 6.9 | Sidebar sticky + logo cliquable | [x] |
| 6.10 | Insight IA locked block (Premium upgrade CTA) sur les sous-pages Performances | [x] |

---

## Phase 7 : Scale & Monétisation (à venir)

| # | Tâche | Statut |
|---|---|---|
| 7.1 | Gestion d'équipe (invitations, rôles, RBAC UI) | [ ] |
| 7.2 | Billing Stripe (plans Starter/Growth/Scale, feature gating) | [ ] |
| 7.3 | API publique REST + gestion clés API | [ ] |
| 7.4 | Webhooks sortants (alert.created, sync.completed, score.changed...) | [ ] |
| 7.5 | Onboarding guidé (wizard de première connexion CRM) | [ ] |
| 7.6 | Persistance des paramètres (server actions pour sauver org settings, rules, thresholds) | [ ] |
| 7.7 | Table activated_reports + persistance des rapports activés | [ ] |
| 7.8 | Webhooks Stripe entrants (ingestion temps réel invoice.paid, subscription.deleted) | [ ] |
| 7.9 | OAuth2 flow complet pour Salesforce/Zoho/QuickBooks (refresh token rotation) | [ ] |

---

## V2 : Temps réel & Enterprise

| # | Tâche | Statut |
|---|---|---|
| V2.1 | **Insights temps réel via WebSocket / Server-Sent Events** — les insights IA se recalculent et se poussent au client PENDANT que l'utilisateur est sur la page, sans refresh. Utile quand un sync se termine en background et que les insights cross-source changent instantanément. Nécessite Supabase Realtime ou un custom SSE endpoint. | [ ] |
| V2.2 | Activity feed temps réel (notifications push dans la cloche) | [ ] |
| V2.3 | Vue 360° par compte (fiche client unique, toutes sources croisées) | [ ] |
| V2.4 | Réconciliation manuelle UI (queue de non-matchés à valider) | [ ] |
| V2.5 | Field mapping UI (drag-and-drop CRM → schéma Revold) | [ ] |
| V2.6 | Multi-pipeline forecast board (forecast par pipeline avec probabilités et scoring IA) | [ ] |
| V2.7 | SSO / SAML pour les clients Enterprise | [ ] |
| V2.8 | Audit log complet (qui a fait quoi, quand) — activé par /audit-logs/v3 HubSpot Enterprise | [ ] |
| V2.9 | Export PDF/CSV des rapports et insights | [ ] |
| V2.10 | White-label (custom domain + branding) pour les agences RevOps | [ ] |

---

## Journal de Sessions

| Date | Phase | Tâches complétées | Notes |
|---|---|---|---|
| 2026-04-06 | — | Diagnostic initial, création roadmap | Squelette analysé, plan validé |
| 2026-04-07 | Phase 1-3 | 1.1–3.5 complétés | Auth, DB, UI, scoring, insights IA, forecast |
| 2026-04-07 | Phase 4 | 4.1-4.2 | HubSpot sync engine, monitoring |
| 2026-04-08 | Phase 4-5 | 4.3-5.6 | Détection intégrations (7 signaux), canonical model, 13 connecteurs, cross-source insights, data model insights |
| 2026-04-08 | Phase 6 | 6.1-6.4 | Performances 4 sous-pages, Rapports 3 sous-pages, Paramètres 5 sous-pages, pipeline analytics |
| 2026-04-09 | Phase 6 | 6.5-6.10 | SIREN/SIRET/TVA, entity resolution avancée, alertes dropdown, logo redesign |
| 2026-04-10 | Phase 6 | 6.6 enrichi | Audit CRM complet dans insights IA, blueprint règles de résolution par stack, email+SIREN combo, external ID mapping |
