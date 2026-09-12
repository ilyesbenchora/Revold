# SEO / GEO — semaine du 12 septembre 2026

Ligne de base avant toute optimisation. Search Console (28 jours, 13/08 → 10/09) : 0 clic, 285 impressions. « revold » en position 4,4 (14 impressions), « revops » à 48,8, « audit crm » à 96,8 ; les 73 autres requêtes cibles n'ont aucune impression : les 61 pages créées les 11 et 12 septembre ne sont pas encore indexées. 0 citation sur 5 questions GEO.

**3 variations.** Sitemap passé de 26 à 76 URLs. Trois requêtes à impressions sans page cible ajoutées au registre (fiabiliser les données CRM, résolution d'entités). Sept pages comparatives (Clari, Gong, Forecastio, Salesforce, Aviso, BoostUp, Prévisions HubSpot) dépubliées par ailleurs : leurs requêtes sont repointées vers les guides.

**Actions appliquées** (signal → changement → indicateur) :
1. Balise title des 54 articles doublait la marque (« — Blog Revold — Revold ») → title absolu « — Revold ». Indicateur : titles affichés entiers dans la SERP.
2. 12 requêtes P1 absentes du title de leur page (audit) → 15 titles de guides et 4 d'outils réécrits ≤ 60 caractères avec la requête en tête (ex. « Intégration HubSpot Pennylane… », « Réconciliation CRM facturation… », « Calculateur churn gratuit : calcul churn… »). Indicateur : impressions sur ces requêtes sous 4 semaines.
3. « revold tarifs » : title de /tarifs passé à « Revold — Tarifs et plans… ». Indicateur : position sur la requête de marque.
4. 4 descriptions > 200 caractères ramenées ≤ 160 (fuite de revenus, HubSpot × Pennylane, HubSpot × Sage, audit CRM).

**À faire hors code (Ilyes).** 1) Rétablir l'accès en écriture de l'app GitHub « Claude » sur ilyesbenchora/Revold (la routine n'a pas pu publier). 2) Demander l'indexation des 10 pages prioritaires dans Search Console. 3) Bing Webmaster Tools + fiches d'entité (G2, Capterra, Crunchbase, LinkedIn).

---

## Conditions de mesure

- Exécution manuelle de la routine cloud le 12/09 à 11h33 : audit réalisé, mais publication impossible (git push, API GitHub et connecteur refusés en 403 : l'application GitHub « Claude » n'a plus l'accès en écriture au dépôt). Le dossier `audits/` ne contenait aucun rapport avant celui-ci : les routines CTO et Revenue étaient dans la même situation.
- Search Console branchée le 12/09 (compte de service, propriété `sc-domain:revold.ai`). Variable `GSC_SERVICE_ACCOUNT_JSON` posée sur Vercel ; à poser dans l'environnement de la routine.
- Audit technique local sur la production : 71 URLs en 200, 208 ms en moyenne, robots IA déclarés, llms.txt et RSS (hub WebSub) en place.

## Requêtes cibles (Search Console, 28 jours)

| Requête | Groupe | Position | Impressions | Page |
|---|---|---|---|---|
| revold | marque | 4,4 | 14 | / |
| revops | métier | 48,8 | 58 | /blog/qu-est-ce-que-le-revops-guide-complet-2026 |
| audit crm | métier | 96,8 | 32 | /blog/audit-crm-par-ou-commencer |
| fiabiliser les données crm (hors registre) | métier | 31,2 | 46 | /solutions/fiabiliser-donnees |
| résolution d'entités (hors registre) | longue traîne | 21,4 | 45 | /produits/resolution-entites |
| résolution d'entités dynamique (hors registre) | longue traîne | 15,2 | 20 | /produits/resolution-entites |
| 70 autres requêtes cibles | — | — | 0 | pages non encore indexées |

## Diagnostic

- Aucune page nouvelle n'a d'impression : le levier de la semaine est l'indexation (sitemap soumis, demandes d'indexation manuelles), pas le contenu.
- Les seules pages qui ont des impressions sont anciennes ; « résolution d'entités » (positions 15 à 21) est la requête la plus proche du top 10 : page produit à surveiller, pas à modifier tant qu'elle monte.
- Le doublon de marque dans les titles d'articles coûtait 15 caractères sur chaque article ; corrigé avant l'indexation, donc sans effet de bord.

## Indicateurs à vérifier la semaine prochaine

- Nombre de requêtes cibles avec impressions (base : 3 / 76).
- Position de « revold » (base : 4,4) et de « résolution d'entités » (base : 21,4).
- Pages indexées parmi les 10 prioritaires (Search Console → Pages).

## Fichiers modifiés

`app/blog/[slug]/page.tsx`, `app/tarifs/page.tsx`, `lib/seo/keyword-pages.ts`, `lib/seo/tools.ts`, `lib/seo/keywords.ts`.
