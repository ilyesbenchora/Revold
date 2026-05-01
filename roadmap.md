# Roadmap Revold

> **Dernière mise à jour** : 2026-04-30
> **Statut global** : Phase 6 finalisée — Phase 7 amorcée — Phase 8 quasi terminée : 8.1 OAuth HubSpot multi-tenant ✅, 8.2 Stripe billing ✅ (config Stripe Dashboard à finaliser côté user), 8.3 sync engine robuste ✅, 8.4 notifications email + Slack/Teams ✅, 8.5 RBAC équipe + invitations + audit log ✅, 8.8 Vitest + Sentry + Vercel Analytics ✅, 8.9 sécurité publique + DPA + EU ✅, 8.10 onboarding wizard ✅. Restent : 8.6 perf scaling > 50k contacts, 8.7 activity capture (Aircall/Chrome), **8.11 marketplace listings (HubSpot App + Stripe Partner)** = canal d'acquisition organique vs Clari (pré-requis livrés : pricing public + sécurité + onboarding ≤ 5 min).
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
| 6.11 | Site marketing complet (produits, solutions, équipes, tarifs, blog, légal, demo, contact, intégrations) + navbar + SEO (robots, sitemap, JSON-LD Organization, icon 48x48 + apple-icon) | [x] |
| 6.12 | Builder de rapport sur mesure : 4 étapes (Équipe → Catégorie → KPI → Filtres), 175 KPIs implémentés référencés dans IMPLEMENTED_KPIS, validation API stricte | [x] |
| 6.13 | Disponibilité KPI par CRM (`/api/reports/kpi-availability` 5min cache) — 3 buckets dans le picker (✅ avec données / 🟠 vide / 🔒 bientôt) | [x] |
| 6.14 | 1 KPI par rapport (radio) + sélecteur de format de visualisation (auto / gauge / donut / bar_h / bar_chart / line_chart / area_chart / sparkline / evaluation) avec recommandation auto par KPI | [x] |
| 6.15 | Étape Filtres en 2 onglets internes (Principal / Options) — options regroupant pipeline, owner, équipe HS, lifecycle, sources, propriété custom | [x] |
| 6.16 | Section "Coaching IA à faire" toujours présente dans chaque rapport, générateur CRO/RevOps mappé par famille de KPI (workflow / property / integration / data_model / process), bouton Activer ce coaching | [x] |
| 6.17 | Table report_coachings + API POST /api/reports/activate-coaching + PATCH /api/reports/coachings/[id] (active/done/removed) | [x] |
| 6.18 | Refonte des 6 pages Coaching IA en 4 onglets internes (Mes coachings IA / Critiques / Vigilance / Infos) + chips filtre par type d'action + suppression de l'ancienne navbar top redondante | [x] |
| 6.19 | Renommage UI Commercial → Ventes (libellés équipe), RevOps/Finance → Revenue/Finance | [x] |
| 6.20 | Refonte Simulations IA (ex-Scénarios) en 4 onglets (Mes alertes / Pipeline / Lifecycle / Données) + filtre par équipe + activation → refresh auto | [x] |
| 6.21 | Sidebar : Audit en dropdown groupé, Coaching IA en dropdown groupé (7 sous-pages), hover gradient amber→fuchsia sur les pages IA | [x] |

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
| 7.7 | Table activated_reports + persistance des rapports activés | [x] |
| 7.8 | Webhooks Stripe entrants (ingestion temps réel invoice.paid, subscription.deleted) | [ ] |
| 7.9 | OAuth2 flow complet pour Salesforce/Zoho/QuickBooks (refresh token rotation) | [ ] |

---

## Phase 8 : GTM-critical foundations (à attaquer pour shipper en prod)

> Diagnostic 2026-04-19 : le produit a 80 % de l'iceberg manquant pour concurrencer Clari. Voici ce qui doit être en place AVANT de pouvoir vendre, pas après. Priorisé par impact business.

| # | Tâche | Effort | Statut |
|---|---|---|---|
| 8.1 | **OAuth HubSpot multi-tenant** — OAuth flow `/api/integrations/hubspot/callback` qui stocke `access_token` + `refresh_token` + `portal_id` par org dans `integrations` ; rotation auto via `getHubSpotToken` (refresh < 5 min restantes) ; fallback env var supprimé (faille multi-tenant fermée) ; cleanup orphans + parity drift = 0 garantissent l'exactitude des données par org. | M | [x] |
| 8.2 | **Stripe billing + 3 plans (Starter / Growth / Scale)** + trial 14j + paywall — table `org_subscriptions`, lib `lib/billing/` (catalogue PLANS, helpers Stripe sans SDK, signature webhook HMAC SHA-256), API `/api/billing/checkout` + `/api/billing/portal` + `/api/webhooks/stripe`, page `/dashboard/parametres/billing` avec affichage plan + prochaine échéance. **Reste manuel côté Stripe Dashboard** : créer les 3 produits + 6 prices monthly/yearly + STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_PRICE_ID_* en env Vercel. | L | [x] |
| 8.3 | **Sync engine robuste** — webhook HubSpot merge + deletion (cleanup local actif), full sync avec DELETE WHERE hubspot_id NOT IN HubSpot, pagination cursor-based, retry exponentiel sur 429, service-role client (bypass RLS), cache Supabase fast-read (UI à zéro HubSpot live), parity drift = 0 garanti après chaque sync. | L | [x] |
| 8.4 | **Notifications email + Slack/Teams** — table `notification_channels` + API CRUD `/api/notifications/channels` ; cron `daily-digest` + cron `check-alerts` ; activation par alerte depuis Simulations IA (Cycle de ventes / Marketing / Deals à risques / Revenue / Données) et depuis Performances Ventes (sélection objectif + canal de notification). | M | [x] |
| 8.5 | **Auth équipe + invitations + RBAC** — `profiles.role` CHECK admin/manager/rep, table `invitations` (token magic link, expiration 7j, revoke), table `audit_log` (member.*, billing.*, integration.*, settings.*), lib `lib/auth/rbac.ts` (`getCurrentRole`, `requireRole`, `roleAtLeast`, `logAudit`), API `/api/team/invite` + `/api/team/members/[id]` (PATCH role, DELETE), page `/auth/invitation?token=`, page Paramètres → Équipe (lister membres, changer rôle, supprimer, inviter). Garde-fou : impossible de dégrader/supprimer le dernier admin. | M | [x] |
| 8.6 | **Performance scaling** — pagination des fetches HubSpot, materialized views Supabase, cache pré-calculé via cron pour les CRMs > 50k contacts. | M | [ ] |
| 8.7 | **Activity capture** — extension Chrome ou intégration Aircall/Ringover pour auto-logger les calls. Pain point #1 que Clari/Gong résolvent. | XL | [ ] |
| 8.8 | **Tests + monitoring** — Vitest 7 fichiers / 44 tests verts (env, kpi-compute, risk-detection, billing-plans, rbac, paiement-facturation-stripe, progress-score), `@sentry/nextjs` configuré (client/server/edge no-op si DSN absent + instrumentation.ts), `@vercel/analytics` activé via `<Analytics />` dans root layout, sourcemaps Sentry uploadés en build si `SENTRY_AUTH_TOKEN` configuré. | M | [x] |
| 8.9 | **Page Sécurité publique + DPA + hébergement EU explicite** — page `/legal/securite` enrichie (EU hosting Frankfurt explicite, table sous-processeurs avec régions/certifs, RTO/RPO, sauvegardes, programme de divulgation responsable, SOC 2 Type 1 visé Q4 2026), nouvelle page `/legal/dpa` (DPA RGPD complet 12 articles, conforme clauses contractuelles types CE 2021/914), liens dans tous les footers + sitemap + nav layout legal, contacts dpo@revold.io et security@revold.io. | S | [x] |
| 8.10 | **Self-serve onboarding wizard** — table `onboarding_state` (4 étapes : welcomed / hubspot_connected / objectives_set / first_sync_seen + `completed_at` + `skipped`), lib `lib/onboarding/state.ts` (getOnboardingState + shouldShowOnboarding + onboardingProgress), API GET/PATCH `/api/onboarding/state`, page `/dashboard/onboarding` (wizard 4 écrans avec progress bar + skip), banner dashboard root avec progress %, auto-détection HubSpot connecté + 1er sync visible (n'oblige pas l'user à re-cliquer "fait"). Orgs existantes auto-marquées comme onboardées via SQL pour ne pas les ennuyer. | L | [x] |
| 8.11 | **Marketplace listings** — Pré-requis techniques tous livrés : page listing détaillée HubSpot `/integrations/hubspot` (features + scopes justifiés + install steps + trust), idem Stripe `/integrations/stripe`, OAuth callback opérationnel avec refresh rotation, RBAC, pricing public, sécurité+DPA+RGPD, onboarding ≤ 5 min, Sentry monitoring, sitemap mis à jour. Checklist soumission dans `MARKETPLACE.md`. **Reste manuel côté user** : compléter le profil app dans HubSpot Developer Account, uploader les assets visuels (icon 128×128 + 512×512, featured image, 5 screenshots), soumettre à review HubSpot (3-6 sem) et Stripe Partner Directory (1-2 sem). | XL | [~] |

---

## Avantages concurrentiels à durcir vs Clari

> Clari = leader US Revenue Intelligence ($60k/an typical, 3 mois de mise en place, Salesforce-first). Voici les angles où Revold peut gagner sur le marché européen.

| # | Angle | Description | Action |
|---|---|---|---|
| C.1 | **Cross-source natif HubSpot + Stripe + Pennylane + Sellsy + Qonto** ⭐ | Clari est CRM-centric. En Europe, le stack est fragmenté HubSpot + outils de billing FR. Revold a déjà le modèle canonique (`source_links`, `invoices`, `subscriptions`, `payments`). | Finir Stripe + Pennylane branchés en prod, en faire le positioning #1 sur la home. |
| C.2 | **AI coaching action-oriented (vs analytics passive)** | Clari montre la donnée, Gong analyse les calls. Aucun ne **transforme la donnée en plan d'action persistant** par catégorie d'équipe. Le flow rapport → analyse → coaching activable existe déjà. | Couche LLM (Claude/GPT) pour générer des plans contextualisés au CRM réel du client, pas juste des templates. |
| C.3 | **PME-friendly pricing + setup < 1h** | Clari = enterprise-only. Marché PME français/européen 30-200 personnes ignoré. | Self-serve onboarding (8.10) + free trial 14j (8.2) + 3 plans clairs €99-499/mois. |
| C.4 | **RGPD-native + hébergement EU + UI française** | Clari est US, pitch européen difficile à cause de RSSI / souveraineté data. | Page Sécurité publique (8.9) + DPA template + hébergement Frankfurt explicite + SOC 2. |
| C.5 | **Verticalisation B2B SaaS européen** | Clari sert tout. Revold pourrait dominer 1 vertical : B2B SaaS / agences SaaS françaises 20-200 personnes (stack HubSpot + Stripe/Pennylane). | ICP serré + features sur-mesure (MRR/ARR par cohorte, churn prediction, expansion revenue). |

---

## Stratégie GTM (3-12 mois pour atteindre PMF)

### Phase GTM-1 : Trouver le PMF (T+0 → T+6 mois)

- [ ] **Définir l'ICP exact** : DAF / Head of RevOps en B2B SaaS français 30-150 personnes, stack HubSpot + Stripe ou Pennylane
- [ ] **20 clients early adopter** en hand-rolled — pricing 99 €/mois pour valider, pas pour gagner du cash
- [ ] **Mesurer en continu** : NPS, retention 90j, % features utilisées par client, time-to-first-coaching-activated
- [ ] **Itérer** sur les 1-2 cas d'usage les plus stickys qui ressortent
- [ ] **Page Sécurité + DPA + EU hosting** publique (préparation pitch DSI)
- [ ] **OAuth HubSpot + Stripe billing live** (sans ça, impossible d'onboarder le 2e client)

### Phase GTM-2 : Scaler le PLG (T+6 → T+12 mois)

- [ ] **Self-serve onboarding** OAuth HubSpot one-click → premier insight en < 5 min
- [ ] **Content SEO français** — niche peu travaillée par les concurrents : "comment forecaster en HubSpot", "pourquoi votre CA CRM ≠ CA facturé", "audit gratuit qualité données HubSpot"
- [ ] **Partenariats** : intégrateurs HubSpot Solutions Partners FR, agences RevOps françaises
- [ ] **Free tier** : 1 user / 1000 contacts pour entrer dans les bases CRM des PME
- [ ] **Premier hire** : 1 SDR + 1 CSM, pas de marketing massif tant que la rétention n'est pas > 80 % à 90j
- [x] **Slack/Teams + email digest** quotidien (8.4) — activable par alerte depuis Simulations IA + Performances Ventes
- [ ] **Activity capture** (8.7) — débloque des KPIs activité fiables

### Quick wins prioritaires cette semaine

1. **Page Sécurité publique + DPA + EU hosting** (8.9) — 3 jours, débloque le pitch DSI européens
2. **Stripe billing + 3 plans + trial 14j** (8.2) — 1 sprint, débloque la monétisation
3. **RBAC équipe + invitations magic link** (8.5) — 1 sprint, débloque les boîtes > 20 personnes
4. **Tests + Sentry monitoring** (8.8) — 1 sprint, prérequis pour ouvrir au public

Cela fait passer Revold de "demo qui impressionne" à "produit qu'on signe".
Le **gros levier d'acquisition organique** (8.11 Marketplace HubSpot/Stripe) demande 8.2 + 8.9 + 8.10 en pré-requis (validation HubSpot impose pricing public + page sécurité + onboarding fluide).
Le reste (cross-source full, LLM coaching, verticalisation SaaS) = ce qui fait gagner contre Clari sur le long terme.

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
| 2026-04-11 | Phase 6 | 6.11 (partiel) | Site marketing initié (pages produits, solutions, blog, légal, demo) |
| 2026-04-13 | Phase 6 | 6.11 finalisé | Navbar marketing + SEO (robots, sitemap, JSON-LD Organization, icon 48x48 + apple-icon) |
| 2026-04-16 | Phase 6 | 6.12 (partiel) | Builder de rapport custom — étapes Équipe / Catégorie / KPI / Filtres |
| 2026-04-17 | Phase 6 | 6.12-6.13 | IMPLEMENTED_KPIS (175 KPIs) + validation API + endpoint kpi-availability avec 3 buckets |
| 2026-04-18 | Phase 6 | 6.14-6.18 | 1 KPI/rapport + 9 formats de viz + recommandation auto, étape Filtres en 2 onglets, générateur CRO d'actions par famille de KPI, table report_coachings + APIs activate/PATCH, refonte 6 pages Coaching IA en 4 onglets (Mes coachings IA / Critiques / Vigilance / Infos) + chips action type |
| 2026-04-18 | DB | Migration manquante | Découverte tracking schema_migrations désynchronisé sur 16 migrations — colonnes is_custom/team/filters de activated_reports manquaient en réalité, ajoutées à la volée + audit complet 0 colonne manquante restante |
| 2026-04-19 | Phase 6 | 6.19-6.21 | Renames UI Commercial → Ventes / RevOps → Revenue, Simulations IA (ex-Scénarios) en 4 onglets avec activation → refresh, sidebar Coaching IA en dropdown groupé, hover gradient amber→fuchsia sur les pages IA |
| 2026-04-19 | GTM | Diagnostic concurrentiel | Analyse honnête vs Clari : 80 % de l'iceberg manquant pour shipper en prod. Phase 8 (10 fondations critiques) + 5 angles concurrentiels + plan GTM 3-12 mois ajoutés à la roadmap |
| 2026-04-26 | DB sync | Webhook HubSpot merge + deletion (cleanup local actif), Bootstrap fix NOT NULL relaxées + POST /search | Cleanup local des records mergés/supprimés via webhook HubSpot ; corrige les endpoints POST /search bloqués par contraintes NOT NULL |
| 2026-04-27 | Cache | Dashboard + Adoption lus depuis Supabase cache, Pipeline carousel, Freshness indicator | Sync route en service-role (RLS bloquait silencieusement) ; sim/coaching IA buildContext lit le snapshot cache → real-time ; Lifecycle conversion + Deal risk combiné + Forecast pondéré ; suppression KPI Source sur recos/sim/coaching |
| 2026-04-28 | Audit Workflows | ETL workflows enrichi par-id + audit RevOps détaillé pour CHAQUE workflow | Lite mode + carousel Actif/Inactif ; détection re-enrollment/goal/erreurs + filtre par objet ; détection multi-action/complexité + breakdown UI ; fix catégorisation HubSpot v4 (SINGLE_CONNECTION wrapper) |
| 2026-04-29 | Logo | Itérations Logo Revold | 9 itérations (sablier ⏳ + R + flèche ↗) atterries sur R + flèche forward momentum |
| 2026-04-30 | Sync engine 8.3/8.6 | Full sync : cleanup orphans → parity drift = 0 partout | DELETE WHERE hubspot_id NOT IN HubSpot après upsert (corrige drift permanent que la full sync ne résolvait pas) ; pagination .range() (Supabase JS limite à 1000 rows par défaut) ; countLocal filtre hubspot_id ; NovaTech (org seed legacy mélangeant seed + sync HubSpot) supprimée intégralement |
| 2026-04-30 | Phase 8.1 partiel | Tool mapping → routing data fetching multi-source | UI + data layer respectent désormais "Outil source par page" (`tool_mappings.audit_paiement_facturation`, `audit_service_client`) ; fetcher Stripe live mappé au format commun PaiementFacturationData (Vue d'ensemble + sous-pages /paiement /facturation + Service Client churn/renouvellement/cross-sell) ; fallback HubSpot si pas de mapping. Reste à écrire les fetchers live Zendesk/Intercom/Freshdesk/Crisp pour Service Client |
| 2026-04-30 | UX Navigation | Renames + réordonnance dropdown principal | Audit → Données (parent), Données → Propriétés (sous-page), Adoption → Équipes ; ordre dropdown : Vue d'ensemble → Performances → Automatisations → Paiement & Facturation → Service Client → Équipes → Propriétés ; Vue d'ensemble Données affiche les 7 modules (ajout Paiement & Facturation + Service Client manquants) |
| 2026-04-30 | Phase 8.9 | Page Sécurité publique + DPA + EU hosting | Enrichissement `/legal/securite` (EU Frankfurt explicite, table sous-processeurs, RTO/RPO, bug bounty, SOC 2 roadmap Q4 2026), nouvelle page `/legal/dpa` (12 articles RGPD), lien DPA dans tous les footers + sitemap + nav layout legal |
| 2026-04-30 | Phase 8.2 | Stripe billing + 3 plans + trial 14j | Migration `org_subscriptions` (RLS + CHECK plans), `lib/billing/plans.ts` (catalogue Starter 79€ / Growth 249€ / Scale 699€ + features par plan + helpers Stripe Price ID), `lib/billing/stripe-server.ts` (createCheckoutSession trial 14j sans CB, createPortalSession, upsertSubscriptionFromStripe webhook, verifyStripeWebhook HMAC SHA-256 sans SDK), API `/api/billing/checkout` + `/api/billing/portal` + `/api/webhooks/stripe`, UI `/dashboard/parametres/billing` (plan actif + actions), tab Facturation. **Manuel côté user** : créer produits + prices Stripe, env vars STRIPE_*. |
| 2026-04-30 | Phase 8.5 | RBAC équipe + invitations + audit log | Migration `20260430000002_rbac_invitations.sql` (profiles.role CHECK admin/manager/rep avec migration data 'member'→'admin', table invitations avec token magic link 32 bytes hex, table audit_log), `lib/auth/rbac.ts` (getCurrentRole, requireRole, roleAtLeast, logAudit), API `/api/team/invite` (admin invite tous, manager invite reps uniquement) + `/api/team/members/[id]` (PATCH role + DELETE avec garde dernier admin), page `/auth/invitation?token=` (acceptation magic link), UI `/dashboard/parametres/equipe` (membres + invitations + rôle inline) |
| 2026-04-30 | DB ops | Migrations 8.2 + 8.5 + 8.10 appliquées en prod | Endpoint admin/migrate temporaire avec MIGRATION_SECRET + lib `pg` ; 3 migrations exécutées (`org_subscriptions`, `invitations`+`audit_log`+profiles role check, `onboarding_state`) ; vérification tables ; cleanup endpoint + secret ; TestCorp auto-marquée onboardée pour ne pas voir le wizard |
| 2026-04-30 | Phase 8.8 | Tests + monitoring | Fix progress-score test (refactor label/score) ; nouveaux tests : `billing-plans` (catalogue, planHasFeature, planFromPriceId), `rbac` (roleAtLeast, generateInvitationToken), `paiement-facturation-stripe` (contrat empty key) ; `@sentry/nextjs` (client/server/edge config no-op si DSN absent, instrumentation.ts, withSentryConfig conditionnel) ; `@vercel/analytics` activé via `<Analytics />`. 7 fichiers / 44 tests verts. |
| 2026-04-30 | Phase 8.10 | Self-serve onboarding wizard | Migration `onboarding_state` (4 étapes + objectives jsonb + RLS) ; lib `lib/onboarding/state.ts` ; API `/api/onboarding/state` (GET + PATCH par étape) ; page `/dashboard/onboarding` avec wizard 4 écrans (Bienvenue → HubSpot OAuth → Équipes&Objectifs → Premier sync → CTA 1er insight) + auto-détection HubSpot/sync ; banner dashboard avec progress bar % ; orgs existantes auto-marquées via SQL pour ne pas les déranger |
