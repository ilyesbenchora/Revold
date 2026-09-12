# SEO / GEO — semaine du 12 septembre 2026 (3e passage : maillage et page à impressions)

3e passage du 12/09 (11h02 UTC) — `revold.ai` refusé par le proxy, `GSC_SERVICE_ACCOUNT_JSON` absent : la base reste celle du matin (0 clic, 285 impressions, 3 cibles sur 76).

**3 chiffres.** `/solutions/fiabiliser-donnees` : 46 impressions, position 31,2, **0 lien éditorial entrant** — contre ~8 pour `/produits/resolution-entites` (15,2–21,4). 0 cible cassée sur 75. CI verte sur 7 push d'affilée.

**3 variations.** (1) L'indicateur du correctif CI de 10h18 est atteint : 7 runs verts après 9 rouges. (2) SERP « plateforme RevOps française » : la réponse générative cite Claap, Ocobo, Kano, et le haut de page est tenu par des listicles tiers (Cartelis, Impli, Tellao) — le levier GEO est d'y figurer. (3) « revold » (4,4) est disputée par rev.ai, revvo.ai, revol.ai et blog.revold.us.

**2 actions.** (1) `/solutions/fiabiliser-donnees` : « fiabiliser les données crm » (2e requête du site en impressions) absente du H1, approximative dans le title → les deux réécrits avec les mots exacts. (2) `lib/seo/glossary.ts` : le terme « Résolution d'entités » ne pointait vers aucune page alors que la requête homonyme est la plus proche du top 10 → lien ajouté.

**Hors code.** 1) Inscrire Revold chez Cartelis, Appvizer, Salesdorado : c'est ce qui est cité sur la requête métier. 2) Fiches G2, Capterra, Crunchbase puis `sameAs` : quatre homonymes occupent la requête de marque. 3) Indexation des 10 pages prioritaires, et `GSC_SERVICE_ACCOUNT_JSON` dans l'environnement de la routine.

---

## Conditions de mesure

| Source | État |
|---|---|
| `node scripts/seo-audit.mjs` | **Non exécutable.** `revold.ai:443` refusé par le proxy d'egress (`connect_rejected`, relevé 11h02:56). Audit fait depuis les registres. |
| `node scripts/seo-search-console.mjs` | **Non exécutable.** `GSC_SERVICE_ACCOUNT_JSON` absent de l'environnement de la routine. |
| Positions | Reprises de la mesure Search Console du matin (28 j, 13/08 → 10/09). Inchangées : aucune nouvelle donnée en 90 minutes. |
| SERP / GEO | 2 vérifications WebSearch faites (voir plus bas). `site:revold.ai` n'est pas honoré par l'outil : l'indexation reste non mesurable depuis le sandbox. |
| `npm ci` | OK. `tsc`, `eslint`, 95 tests : verts. |

## Ce que l'audit hors ligne a mesuré

Audit des registres (`lib/seo/*.ts`, `app/blog/articles-*.ts`) élargi au maillage interne : pour chaque cible, comptage des liens entrants dans les `related`, les corps d'articles, le glossaire et les comparatifs.

| Mesure | Valeur |
|---|---|
| Cibles pointant vers une page non servie | 0 / 75 |
| Requêtes P1 | 27 (22 avec la requête dans le title) |
| Slugs en double / dates d'article en double | 0 / 1 (12/09, paire de lancement assumée) |
| Calendrier éditorial | 54 articles, 14 publiés, 40 programmés jusqu'au 28/01/2027 (20 semaines d'avance) |
| Guides sans FAQ / articles programmés sans FAQ | 0 / 0 |
| Titles > 60 caractères | 8 |
| Descriptions hors 120–160 | 24 |

### Liens internes entrants des pages qui ont des impressions

C'est la mesure nouvelle de ce passage, et elle est parlante :

| Page | Position | Impressions | Liens éditoriaux entrants |
|---|---|---|---|
| `/produits/resolution-entites` | 15,2 – 21,4 | 65 | ~8 (footer, navbar, accueil, 2 pages solutions, 4 corps d'articles, 3 blocs `related`, llms.txt) |
| `/solutions/fiabiliser-donnees` | 31,2 | 46 | **0** (uniquement navbar + nav de section) |
| `/audit-crm-hubspot` | — | 0 | 15 |
| `/blog/qu-est-ce-que-le-revops…` | 48,8 | 58 | 1 |

Deux pages au volume d'impressions comparable, quinze places d'écart, et la différence la plus visible est le maillage. Ce n'est pas une preuve de causalité, mais c'est le seul écart mesuré disponible, et il désigne un levier gratuit et réversible.

## Actions de la semaine

### Action 1 — `/solutions/fiabiliser-donnees` : la requête n'est ni dans le H1 ni exacte dans le title

**Signal** → « fiabiliser les données crm » : 46 impressions, position 31,2 (Search Console, 28 j) — deuxième requête du site en impressions. Le H1 servi est « Fiabilisez vos données une bonne fois pour toutes. » : il ne contient pas « CRM ». Le title est « Fiabiliser **ses** données CRM », quand la requête tapée est « fiabiliser **les** données CRM ».

**Hypothèse** → une page de position 31 sur une requête qu'elle ne porte ni dans son H1 ni exactement dans son title est mal alignée sur l'intention ; remettre les mots exacts est le changement à plus fort effet attendu et le moins risqué (aucune refonte, aucun contenu ajouté).

**Changement** → `app/solutions/fiabiliser-donnees/page.tsx`

_Avant_
```tsx
title: "Fiabiliser ses données CRM",
…
title="Fiabilisez vos données"
```

_Après_
```tsx
title: "Fiabiliser les données CRM : audit, doublons, SIREN",   // 51 car. → 60 avec « — Revold »
…
title="Fiabilisez vos données CRM"
```

La meta description (136 caractères) est déjà dans le gabarit et n'est pas touchée.

**Indicateur (semaine du 19/09)** → position de « fiabiliser les données crm » < 31,2, et impressions ≥ 46. Si la position ne bouge pas mais que les impressions montent, l'alignement a joué sur la pertinence sans suffire au classement : le relais sera le maillage (action différée n° 1 ci-dessous).

### Action 2 — le glossaire ne pointe pas vers la page de la requête la plus proche du top 10

**Signal** → « résolution d'entités » (21,4) et « résolution d'entités dynamique » (15,2) sont les requêtes les mieux classées du site hors marque. Le terme « Résolution d'entités » du glossaire est le seul de sa famille sans `link` : `fuite-de-revenus`, `reconciliation`, `audit-crm`, `kpi-cable`, `signe-facture-encaisse` pointent tous vers leur page.

**Hypothèse** → une incohérence de maillage, pas un choix éditorial. Le glossaire est la page que les moteurs génératifs reprennent le plus volontiers (JSON-LD `DefinedTerm`) : l'ancre qui manque est celle qui mène à la page à faire ranker.

**Changement** → `lib/seo/glossary.ts`, terme `resolution-d-entites`

_Avant_
```ts
definition: "… le SIREN, le SIRET et le numéro de TVA intracommunautaire." },
```

_Après_
```ts
definition: "… le SIREN, le SIRET et le numéro de TVA intracommunautaire.", link: { href: "/produits/resolution-entites", label: "Résolution d'entités" } },
```

La page cible n'est pas modifiée : elle progresse (15,2–21,4), la doctrine interdit d'y toucher. Seul le lien entrant est ajouté.

**Indicateur (semaine du 19/09)** → position de « résolution d'entités » < 21,4 et de « résolution d'entités dynamique » < 15,2.

## Actions identifiées et volontairement différées

| Action | Signal | Pourquoi pas aujourd'hui |
|---|---|---|
| Lier `completude` et `doublon` (glossaire) vers `/solutions/fiabiliser-donnees` | 0 lien éditorial entrant | L'action 1 vise déjà cette page. Deux leviers la même semaine rendraient l'indicateur inexploitable. Au 19/09 si la position n'a pas bougé. |
| Ajouter « prévision des ventes » à la réponse directe de `/forecast-commercial` | P1, volume fort, absente de l'`answer` | Page dont le title a été réécrit ce matin (`33efdf6`) : une semaine de recul. Au 19/09. |
| 24 descriptions hors 120–160, 8 titles > 60 | Audit hors ligne | Cinq de ces pages ont été réécrites ce matin (recul) ; les trois `/alternative/*` n'ont aucune impression — la troncature coûte du CTR, pas du classement. Sans impressions, il n'y a rien à gagner. |
| Passer « fiabiliser les données crm » en priorité 1 | 2e requête du site en impressions | `lib/seo/keywords.ts` a été modifié ce matin ; le changement de priorité ne modifie aucune page servie et peut attendre le passage du 19/09 avec les nouvelles données. |
| Verticale outils (Zendesk, Qonto, ERP) | Aucune requête outil à impressions | Aucun signal mesuré. Créer ces pages aujourd'hui serait agir pour agir. |

## Vérifications SERP / GEO

**« meilleure plateforme RevOps française revenue intelligence PME »** — Revold non cité. La réponse générative cite Claap (revenue intelligence, rachetée par lemlist), puis les agences Ocobo, Kano, Ideagency. Le haut de page est occupé par des listicles tiers : Cartelis (« Top 10 Outils RevOps »), Impli, Tellao, MakeTheGrade, ConteurDigital, Salesdorado.

Diagnostic : sur cette requête, ce ne sont pas les pages d'éditeurs qui sont citées, ce sont les comparatifs tiers. Publier un guide de plus sur `revold.ai` ne changera pas cette réponse ; y figurer, oui. Cela transforme la recommandation « backlinks » du playbook en action datée et ciblée (voir hors code n° 1).

**« site:revold.ai »** — l'outil de recherche n'honore pas l'opérateur `site:` et renvoie des résultats généraux. L'indexation reste non mesurable depuis ce sandbox ; elle le sera par Search Console. À noter dans les résultats : `blog.revold.us` (« REVOLD BLOG — Discover Finance, AI, and Global Trends »), homonyme actif sur le champ finance / IA, plus rev.ai, revvo.ai et revol.ai. La position 4,4 sur la requête de marque s'explique : quatre homonymes occupent le terrain, et le `sameAs` de Revold ne déclare qu'un seul profil (LinkedIn).

Les trois autres questions GEO (alternative à Clari, fuite de revenus, calculateur MRR) ont été posées ce matin — 0 citation — et 90 minutes ne produisent aucune variation mesurable.

## Bilan des actions précédentes

| Action | Indicateur annoncé | Résultat |
|---|---|---|
| Directive `@ts-expect-error` retirée (10h18) | CI verte au prochain push | ✅ **Atteint et confirmé** : 7 runs verts d'affilée, #415 (`4a71b3b`) → #421 (`3cd0fdd`), après 9 rouges. |
| 15 titles de guides + 4 d'outils avec la requête P1 en tête (matin) | Impressions sous 4 semaines | ⏳ Trop tôt. Vérifiable aujourd'hui : 22 P1 sur 27 ont leur requête dans le title. |
| Requêtes des 7 comparatifs dépubliés repointées | 0 cible cassée | ✅ 0 / 75. |
| 4 descriptions ramenées ≤ 160 | descriptions > 160 restantes | ⚠️ 24 pages encore hors gabarit (hors des 4 visées) — différé, voir tableau ci-dessus. |

## Vérifications

- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npx eslint app/solutions/fiabiliser-donnees/page.tsx lib/seo/glossary.ts` → exit 0
- `npm run test:run` → 14 fichiers, 95 tests verts
- 0 slug en double, 0 nouvelle date d'article (aucun article touché)
- `git status` : seuls les deux fichiers ci-dessous sont modifiés

## Fichiers modifiés

- `app/solutions/fiabiliser-donnees/page.tsx` — meta title + H1
- `lib/seo/glossary.ts` — un `link` ajouté au terme `resolution-d-entites`
