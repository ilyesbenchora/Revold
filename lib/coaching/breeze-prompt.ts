/**
 * Génère un prompt LLM ultra-détaillé prêt à coller dans HubSpot Breeze AI
 * (ou tout autre assistant IA HubSpot-aware) à partir d'un coaching Revold.
 *
 * Le prompt inclut :
 *   - le contexte (qui est Breeze, le portail HubSpot, l'objectif Revold)
 *   - le diagnostic et l'impact business
 *   - le plan d'action étape par étape
 *   - les assets à créer (workflows, propriétés, listes, séquences) avec
 *     instructions HubSpot pas-à-pas selon le `actionType` du coaching
 *   - les checks de validation après mise en place
 *
 * Pure function : pas de dépendances externes, pas d'IO. Testable.
 */

import type { UnifiedCoaching, CoachingActionType } from "@/lib/reports/coaching-types";

const SEVERITY_LABEL: Record<UnifiedCoaching["severity"], string> = {
  critical: "🔴 CRITIQUE",
  warning: "🟠 IMPORTANT",
  info: "🔵 AMÉLIORATION",
};

const CATEGORY_LABEL: Record<string, string> = {
  commercial: "Ventes / Pipeline",
  marketing: "Marketing / Lead generation",
  data: "Qualité des données CRM",
  integration: "Intégrations / Stack RevOps",
  "cross-source": "Cross-source (CRM + facturation + support)",
  "data-model": "Modèle de données CRM",
};

function actionTypeBlock(actionType: CoachingActionType, recommendation: string): string {
  switch (actionType) {
    case "workflow":
      return `### 🔧 Workflow(s) HubSpot à créer ou modifier

Pour chaque workflow nécessaire :

1. Va dans **Automation → Workflows → Create workflow**.
2. Choisis le type d'objet pertinent (Contact / Company / Deal / Ticket selon le contexte).
3. Configure le **trigger** (déclencheur) :
   - Type : "When an object is created" / "Property change" / "Form submission" / "Date-based" selon le besoin.
   - Filtres : précise les conditions (ex : \`hubspot_owner_id is unknown\` pour un workflow d'attribution, \`lifecyclestage = lead\` pour un nurturing, etc.).
4. Ajoute les **actions** dans l'ordre logique :
   - Set property value (ex : assigner un owner via round-robin)
   - Send internal email (notifier le manager)
   - Create task (créer une tâche de relance)
   - Branch (if/then) pour les cas conditionnels
   - Delay si besoin de latence (J+3, J+7, J+14)
5. **Active** le workflow seulement après avoir testé sur 2-3 records via "Re-enroll".
6. Active aussi **"Allow contacts to re-enroll"** si la condition peut redevenir vraie.
7. Documente le workflow dans la **description interne** : finalité, KPI surveillé, owner du workflow.

⚠️ Important : avant l'activation, vérifie qu'aucun workflow existant ne traite déjà ce cas (sinon tu risques des doublons d'actions).`;

    case "property":
      return `### 🗂️ Propriété(s) CRM à créer ou modifier

Pour chaque propriété :

1. Va dans **Settings (⚙️) → Properties → [type d'objet : Contact / Company / Deal / Ticket]**.
2. Clique **Create property**.
3. Renseigne :
   - **Group** : choisis (ou crée) un groupe sémantique (ex : "Lead Scoring", "MEDDIC", "Revolde Insights").
   - **Label** : nom court et explicite, en français.
   - **Internal name** : snake_case sans espace (ex : \`mql_score\`, \`bant_budget\`).
   - **Field type** : selon le besoin (Single-line text, Number, Dropdown, Date picker, Calculation, etc.).
   - Si Dropdown : liste les options ET les valeurs internes.
4. **Visibility** : décide qui peut éditer (Sales seulement ? Marketing aussi ?).
5. Si la propriété doit être remplie automatiquement : crée un workflow ou une calculation property.
6. **Backfille** les données existantes via un import CSV ou un workflow rétroactif si pertinent.
7. Ajoute la propriété aux **forms**, **deal stages**, **report dashboards** où elle sert.

⚠️ Si la propriété existe déjà sous un autre nom : ne dupliquez pas. Modifiez l'existante ou utilisez-la telle quelle.`;

    case "report":
      return `### 📊 Rapport / Dashboard à créer

1. Va dans **Reports → Reports → Create report → Custom report builder**.
2. Sélectionne le type d'objet et les sources de données (Deals + Activities + Owners par exemple).
3. Configure les **filtres** : période, owner, pipeline, lifecycle stage selon le KPI.
4. Choisis la **visualisation** : bar chart pour comparer, line chart pour la tendance, table pour le détail.
5. Ajoute les **breakdowns** (ex : par owner, par source, par mois).
6. Sauvegarde dans un **Dashboard partagé** avec les bonnes permissions.
7. Configure une **scheduled email** pour envoyer le rapport automatiquement (hebdo / mensuel) aux décideurs.
8. Définis un **seuil d'alerte** : à quelle valeur le KPI doit déclencher une discussion équipe ?

⚠️ Si le rapport existe déjà : ne le recrée pas. Audite-le et complète-le si besoin.`;

    case "integration":
      return `### 🔌 Intégration à connecter

1. Identifie l'outil exact à brancher (CRM / facturation / téléphonie / support / conversation intelligence).
2. Côté HubSpot : va dans **Settings (⚙️) → Integrations → Connected Apps → Visit App Marketplace**.
3. Recherche l'app, installe-la et autorise les scopes demandés.
4. Configure le mapping de champs : à quelle propriété HubSpot correspond chaque champ source ?
5. Active la synchro bidirectionnelle SI nécessaire (sinon read-only suffit pour l'analyse).
6. Lance une première synchro manuelle, vérifie le volume importé.
7. Audite la **qualité du mapping** : 5 records aléatoires → données cohérentes des deux côtés ?
8. Documente la connexion (qui est admin, quel est le scope, quand ça a été mis en place).`;

    case "data_model":
      return `### 🧱 Évolution du modèle de données CRM

1. Cartographie les **objets concernés** (Contact / Company / Deal / Custom Object / Ticket) et leurs relations.
2. Si tu crées un **custom object** :
   - Settings → Objects → Custom Objects → Create
   - Définis : Nom singulier/pluriel, Primary display property, Secondary property, Search properties
   - Crée les associations avec Contact / Company / Deal
3. Si tu modifies les **deal stages** : ne supprime jamais une stage utilisée. Renomme ou marque "deprecated".
4. Si tu introduis un **lifecycle stage custom** : adapte les workflows et reports en cascade.
5. Backfille les données existantes après le changement (workflow rétroactif ou import).
6. Communique le changement aux équipes : nouveau process, nouvelle propriété, nouveaux reports.

⚠️ Toujours tester sur un sandbox HubSpot AVANT toute modif structurelle en prod.`;

    case "process":
    default:
      return `### 📋 Process / Action manuelle

Cette recommandation nécessite une action humaine plutôt qu'un asset HubSpot à créer :

1. Identifie le ou les **owner(s)** responsables.
2. Définis l'**échéance** précise (date limite ou récurrence : hebdo, mensuelle).
3. Documente le process dans le **Knowledge Base interne** ou la doc d'équipe.
4. Crée une **task récurrente** dans HubSpot pour ne pas oublier (Tasks → Create task → Repeat).
5. Surveille le KPI associé : si le process est suivi, le KPI doit s'améliorer.

Cible précise du process à mettre en place : ${recommendation.slice(0, 200)}`;
  }
}

export function buildBreezePrompt(item: UnifiedCoaching): string {
  const sevLabel = SEVERITY_LABEL[item.severity];
  const catLabel = CATEGORY_LABEL[item.category] ?? item.category;
  const assetBlock = actionTypeBlock(item.actionType, item.recommendation);

  return `# 🎯 COACHING REVOPS — À METTRE EN PLACE DANS HUBSPOT

> Bonjour Breeze, voici un coaching RevOps détecté par Revold (plateforme d'intelligence revenue). J'ai besoin que tu m'aides à le mettre en place dans mon portail HubSpot, étape par étape.

---

## 📌 NIVEAU DE PRIORITÉ

**${sevLabel}** — Catégorie : ${catLabel}

---

## 🔍 DIAGNOSTIC

**${item.title}**

${item.body}

---

## 💥 IMPACT BUSINESS SI NON ADRESSÉ

${item.body}

Sans action :
- KPI dégradé sur la durée (closing rate, qualification, pipeline coverage, churn)
- Décisions pilotées sur des données partielles ou faussées
- Perte de productivité commerciale et marketing
${item.severity === "critical" ? "- ⚠️ Impact direct sur le revenue à court terme" : ""}

---

## ✅ COACHING À RÉALISER (objectif)

${item.recommendation}

---

## 🛠️ PLAN D'ACTION DÉTAILLÉ DANS HUBSPOT

${assetBlock}

---

## 📈 VALIDATION & SUIVI

Une fois la mise en place faite :

1. **Test fonctionnel** : déclenche le scénario sur 2-3 records pour vérifier le comportement.
2. **Vérification du KPI** : note la valeur actuelle, fixe une cible à 30 jours.
3. **Audit hebdomadaire** sur les 4 premières semaines : ajuste si besoin.
4. **Reporting** : ajoute le KPI au dashboard équipe pour visibilité continue.
5. **Itération** : si le KPI ne bouge pas après 30 jours, audite ce qui bloque (adoption, configuration, données).

---

## 🤖 INSTRUCTIONS POUR BREEZE

Breeze, ton rôle :

1. **Lis attentivement** le diagnostic et le plan d'action.
2. **Ne crée AUCUN asset** sans valider d'abord avec moi le scope précis.
3. **Vérifie l'existant** : avant de créer un workflow / une propriété / une liste, confirme qu'il n'y a pas de doublon.
4. **Propose le titre exact** des assets à créer (workflow name, property internal name, list name) en respectant la convention de nommage HubSpot.
5. **Liste les permissions** dont tu as besoin pour exécuter chaque étape.
6. **Demande confirmation** avant chaque action irréversible (suppression, modification de propriété en prod, désactivation de workflow).
7. **Récapitule** à la fin tout ce qui a été créé / modifié, avec liens directs.

Source : Revold (${item.category}, ${item.actionType}, id: ${item.templateKey ?? item.reportCoachingId ?? item.id})
`;
}
