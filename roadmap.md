# Roadmap Revold

> **Dernière mise à jour** : 2026-04-06
> **Statut global** : Phase 4 — Intégrations (3/5 complétées, reste Salesforce + field mapping)
> Ce fichier est mis à jour après chaque session de travail.

---

## Diagnostic Express

- **Stade actuel** : Maquette fonctionnelle (squelette Next.js, zéro backend)
- **Note architecture** : 4/10
- **Positionnement** : Plateforme d'intelligence revenue, marché B2B français
- **Différenciateurs** : French-native, AI-native scoring, pricing SMB/Mid-Market, méthodologie RevOps opinionated

---

## Modèle de Données Cible (Supabase)

```
organizations     — Tenants (name, slug, plan, hubspot_portal_id, salesforce_org_id)
profiles          — Users étendant auth.users (organization_id, role, full_name)
pipeline_stages   — Étapes customisables par org (name, position, probability, is_closed_won/lost)
companies         — Comptes/prospects (segment, industry, domain, CRM IDs)
contacts          — Personnes (email, company_id, is_mql, is_sql)
deals             — Opportunités (amount, stage_id, owner_id, close_date, win_probability, is_at_risk, risk_reasons jsonb)
activities        — Interactions (type: email/call/meeting/note, deal_id, contact_id, occurred_at)
kpi_snapshots     — Métriques quotidiennes matérialisées (8 KPIs + 3 scores moteur, UNIQUE par org+date)
ai_insights       — Insights générés (category, severity, title, body, recommendation, deal_id nullable)
sync_logs         — Journal de synchronisation CRM (source, direction, status, entity_count)
```

RLS sur chaque table via `organization_id` pour isolation tenant.

---

## Phase 1 : Fondations (Semaines 1-3)

> **Directive : STOP UI. Construire le socle.**

| # | Tâche | Fichiers | Statut |
|---|---|---|---|
| 1.1 | Remplacer auth factice par Supabase Auth (email/password + magic link) | `app/login/actions.ts`, `app/login/page.tsx` | [x] |
| 1.2 | Créer `middleware.ts` (token refresh + redirect edge-level) | `middleware.ts` | [x] |
| 1.3 | Déployer schéma DB (toutes les tables) | `supabase/migrations/` | [x] |
| 1.4 | Seed data démo (1 org, 30-50 deals, 5 stages, activités) | `supabase/seed.sql` | [x] |
| 1.5 | Validation env avec zod + `.env.example` | `lib/env.ts`, `.env.example` | [x] |
| 1.6 | Error/loading boundaries dans le route group dashboard | `app/(dashboard)/error.tsx`, `loading.tsx`, `not-found.tsx` | [x] |
| 1.7 | Setup tests (Vitest + Testing Library + premiers tests auth) | `vitest.config.ts`, `__tests__/` | [x] |
| 1.8 | Dev tooling (Prettier, husky, lint-staged, renommer package) | `.prettierrc`, `.husky/`, `package.json` | [x] |

---

## Phase 2 : Features Core (Semaines 4-7)

> **Les 4 pages manquantes + dashboard dynamique**

| # | Tâche | Statut |
|---|---|---|
| 2.1 | Dashboard connecté aux `kpi_snapshots` réels + sélecteur de période | [x] |
| 2.2 | Page Pipeline — Kanban des deals par stage, drag-and-drop, filtres | [x] |
| 2.3 | Page Deals à Risque — Liste filtrée `is_at_risk=true`, raisons, actions | [x] |
| 2.4 | Page Insights IA — Feed d'insights depuis `ai_insights`, filtres catégorie/sévérité | [x] |
| 2.5 | Page Paramètres — Org settings, pipeline stages, membres, intégrations | [x] |
| 2.6 | Sidebar active state (`usePathname()`) | [x] |
| 2.7 | Moteur de calcul KPI (Edge Function ou cron quotidien) | [x] |
| 2.8 | Charting avec `recharts` ou `tremor` (tendances KPI) | [x] |

---

## Phase 3 : Couche Intelligence (Semaines 8-12)

> **L'IA passe du texte hardcodé à l'analyse réelle**

| # | Tâche | Statut |
|---|---|---|
| 3.1 | Détection de risque rule-based (inactivité >14j, régression stage, slippage date) | [x] |
| 3.2 | Moteur de scoring (formules pondérées configurables par org) | [x] |
| 3.3 | Génération d'insights via Claude API (analyse KPI snapshots → texte NL) | [x] |
| 3.4 | Modèle de forecast (probabilités par stage × historique win rate) | [x] |
| 3.5 | Deal coaching (recommandations contextuelles par deal) | [x] |

---

## Phase 4 : Intégrations (Semaines 13-18)

> **Connecter les sources de données**

| # | Tâche | Statut |
|---|---|---|
| 4.1 | HubSpot OAuth2 + stockage tokens | [x] |
| 4.2 | Sync engine HubSpot (bi-directionnel + webhooks) | [x] |
| 4.3 | Connecteur Salesforce (même pattern) | [ ] |
| 4.4 | Monitoring sync (UI status, logs, erreurs) | [x] |
| 4.5 | UI de mapping de champs CRM → schéma Revold | [ ] |

---

## Phase 5 : Scale (Semaines 19-26)

> **Multi-user, API, monétisation**

| # | Tâche | Statut |
|---|---|---|
| 5.1 | Gestion d'équipe (invitations, rôles, RBAC UI) | [ ] |
| 5.2 | Activity feed temps réel (Supabase Realtime) | [ ] |
| 5.3 | API publique REST + gestion clés API | [ ] |
| 5.4 | Webhooks sortants | [ ] |
| 5.5 | Billing Stripe (plans, feature gating) | [ ] |
| 5.6 | Onboarding guidé | [ ] |

---

## Journal de Sessions

| Date | Phase | Tâches complétées | Notes |
|---|---|---|---|
| 2026-04-06 | — | Diagnostic initial, création roadmap | Squelette analysé, plan validé. Prochaine session : démarrer Phase 1 |
| 2026-04-07 | Phase 1 | 1.1–1.8 complétés | **Phase 1 terminée.** Auth Supabase, middleware, schéma DB (10 tables + RLS), seed démo, validation env, boundaries, Vitest, Prettier |
| 2026-04-07 | Phase 2 | 2.1–2.8 complétés | **Phase 2 terminée.** Dashboard 3 moteurs (Sales/Marketing/CRM), Pipeline kanban, Deals à risque, Insights IA, Paramètres, Sidebar active, recharts |
| 2026-04-07 | Phase 3 | 3.1–3.5 complétés | **Phase 3 terminée.** Moteur KPI (14 métriques, 3 scores), risk detection, scoring, Claude API insights, deal coaching API |
| 2026-04-07 | Phase 4 | 4.1, 4.2, 4.4 complétés | HubSpot OAuth2 complet (auth, callback, token refresh), sync engine (companies, contacts, deals), monitoring sync dans Paramètres, table `integrations`, Vercel cron sync toutes les 6h. Reste : 4.3 Salesforce, 4.5 field mapping |
