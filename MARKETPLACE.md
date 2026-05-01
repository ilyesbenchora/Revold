# Marketplace Listings — Checklist 8.11

Ce document trace la procédure de soumission de Revold à HubSpot App Marketplace
et Stripe Partner Directory. Les pré-requis techniques sont livrés (Phase 8.1
à 8.10). Reste les actions manuelles côté portails partenaires.

---

## HubSpot App Marketplace

### Pré-requis techniques (✅ livrés)

- [x] App publique HubSpot avec OAuth (`HUBSPOT_CLIENT_ID`/`HUBSPOT_CLIENT_SECRET`)
- [x] Callback OAuth fonctionnel (`/api/integrations/hubspot/callback`)
- [x] Refresh token rotation auto < 5 min (`getHubSpotToken`)
- [x] Page de pricing publique : <https://revold.io/tarifs>
- [x] Politique de confidentialité publique : <https://revold.io/legal/confidentialite>
- [x] Page sécurité : <https://revold.io/legal/securite>
- [x] DPA RGPD : <https://revold.io/legal/dpa>
- [x] Page RGPD : <https://revold.io/legal/rgpd>
- [x] Onboarding ≤ 5 min : <https://revold.io/dashboard/onboarding>
- [x] Page support : <https://revold.io/contact>
- [x] Page listing détaillée pour le Marketplace : <https://revold.io/integrations/hubspot>
- [x] OAuth scopes minimum justifiés (table publiée sur la page listing)
- [x] Sentry pour les erreurs runtime
- [x] RBAC (admins / managers / reps)

### Actions manuelles à effectuer

#### 1. HubSpot Developer Account

1. Aller sur <https://developers.hubspot.com> et se connecter avec le compte Revold.
2. Vérifier que l'app `Revold` (CLIENT_ID `2b6c0023-e3f5-4751-b643-9b73ba84c0b5`) existe.
3. Compléter le profil de l'app :
   - **Name** : `Revold`
   - **Description courte** : `Audit CRM + Forecast IA pour HubSpot`
   - **Description longue** : voir <https://revold.io/integrations/hubspot> (copier-coller)
   - **App icon** : 128×128 px (à uploader)
   - **Featured image** : 1280×800 px (à uploader)
   - **Screenshots** : minimum 5 captures écran 1280×800 (Dashboard / Audit / Coaching IA / Pipeline / Reports)
   - **Support contact** : `support@revold.io`
   - **Privacy policy URL** : `https://revold.io/legal/confidentialite`
   - **Terms of service URL** : `https://revold.io/legal/cgu`
   - **Pricing URL** : `https://revold.io/tarifs`
   - **Documentation URL** : `https://revold.io/integrations/hubspot`

#### 2. Configurer l'OAuth public

1. **Required scopes** : laisser uniquement les scopes en lecture seule (cf table sur la page listing).
2. **Optional scopes** : aucun pour V1.
3. **Redirect URLs** : ajouter `https://revold.io/api/integrations/hubspot/callback`.
4. **Install URL** : `https://revold.io/essai-gratuit?source=hubspot-marketplace` (à créer côté Marketplace listing).

#### 3. Soumettre à la review

1. Onglet **Marketplace** → **Submit for review**.
2. Cocher la conformité RGPD + l'engagement à respecter les guidelines.
3. Délai de review : **3 à 6 semaines**.

### Si refus

Le feedback HubSpot est détaillé. Cas typiques :

- **Scopes trop larges** : retirer les scopes non strictement nécessaires.
- **Onboarding pas clair** : enrichir les screenshots et la description.
- **Pricing pas explicite** : améliorer la page `/tarifs`.
- **Sécurité insuffisante** : enrichir `/legal/securite` (déjà très complet).

Re-soumettre dès correction. Pas de cooldown imposé.

---

## Stripe Partner Directory

### Pré-requis techniques (✅ livrés)

- [x] Connecteur Stripe fonctionnel : `lib/integrations/sources/stripe.ts`
- [x] Lecture seule via Restricted Key (rk_…)
- [x] Cross-source HubSpot × Stripe pour MRR/ARR/churn
- [x] Page listing : <https://revold.io/integrations/stripe>
- [x] Documentation publique des permissions

### Actions manuelles

1. Stripe Dashboard → **Settings → Connect** → s'enregistrer comme **Stripe Partner**.
2. Soumettre à <https://stripe.com/partners/directory>.
3. Renseigner :
   - **Tagline** : `Revenue intelligence cross-source HubSpot × Stripe pour PME B2B`
   - **Long description** : voir `/integrations/stripe`
   - **Logo** : 512×512 px PNG transparent
   - **Categories** : Analytics, Reporting, Subscriptions
   - **Industry focus** : SaaS, B2B
   - **Geographic focus** : France, Europe
   - **Pricing URL** : `https://revold.io/tarifs`
   - **Support email** : `support@revold.io`
4. Délai de review : **1 à 2 semaines**.

### Si refus

Stripe est plus permissif que HubSpot. Cas de refus rares :
- Manque de proof-of-traction (peut demander 5+ clients actifs).
- Doublon avec un partenaire existant.

Re-candidature illimitée.

---

## Suivi candidature

| Plateforme | Soumis le | Statut | Notes |
|---|---|---|---|
| HubSpot App Marketplace | _à remplir_ | _en attente_ | |
| Stripe Partner Directory | _à remplir_ | _en attente_ | |

---

## Assets manquants à produire

Avant la soumission, prévoir :

- [ ] Icon Revold 128×128 px (PNG, fond transparent)
- [ ] Icon Revold 512×512 px (PNG, fond transparent)
- [ ] Featured image 1280×800 px (visuel marketing avec logo + tagline)
- [ ] 5 screenshots produit 1280×800 px :
  - [ ] Dashboard Vue d'ensemble
  - [ ] Page Données / Audit propriétés
  - [ ] Page Performances Ventes (graph pipeline)
  - [ ] Page Coaching IA (insight + plan d'action)
  - [ ] Page Onboarding wizard
- [ ] Logo Stripe Partner 512×512 PNG transparent (souvent identique à HubSpot)

Ces assets ne peuvent pas être générés depuis le code — captures d'écran à
faire manuellement depuis l'app en prod.
