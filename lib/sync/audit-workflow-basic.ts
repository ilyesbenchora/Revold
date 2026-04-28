/**
 * Audit CRO/RevOps minimal pour CHAQUE workflow HubSpot.
 *
 * Travaille uniquement sur les métadonnées disponibles dans le cache,
 * sans nécessiter le détail des actions. Génère 5-10 signaux concrets
 * basés sur :
 *   1. Pattern matching sur le nom (anti-patterns + intent detection)
 *   2. Cycle de vie temporel (créé / modifié / révisions)
 *   3. État (actif vs inactif) croisé avec ancienneté
 *   4. Objet ciblé (deals → goal, tickets → SLA, etc.)
 *   5. flowType (calculation, imported, etc.)
 *
 * Le but : aucun workflow ne reste sans valeur ajoutée audit, même quand
 * /v4/flows/{id} et /v3/workflows/{id} renvoient null. C'est le minimum
 * vital qu'on attendrait d'un consultant RevOps qui passe 30s sur chaque.
 */

import type { WorkflowRecommendation } from "@/lib/integrations/hubspot-workflows";

export type WorkflowMeta = {
  id: string;
  name: string;
  enabled: boolean;
  objectType: "contact" | "company" | "deal" | "ticket" | "lead" | "custom" | "unknown";
  flowType?: string;
  createdAt?: string;
  updatedAt?: string;
  revisionId?: number;
};

// ── Pattern matching sur le nom ───────────────────────────────────────

type NameSignals = {
  isTest: boolean;
  isOld: boolean;
  isCopy: boolean;
  suggestsReenrollment: boolean;
  suggestsScoring: boolean;
  suggestsOnboarding: boolean;
  suggestsChurnPrevention: boolean;
  suggestsRenewal: boolean;
  suggestsCrossSell: boolean;
  suggestsHandoff: boolean;
  isAllCaps: boolean;
};

function analyzeName(name: string): NameSignals {
  const n = (name ?? "").toLowerCase();
  return {
    isTest: /\btest\b|\btmp\b|\btemp\b|\bdraft\b|\bbrouillon\b|\bwip\b|\b\(test\)\b/i.test(name),
    isOld: /\[old\]|\bold\b|\bdeprecated\b|à supprimer|à archiver|\bancien\b|\bdépréci/i.test(name),
    isCopy: /^copy of|copie de|\bduplicat/i.test(name),
    suggestsReenrollment: /relance|nurturing|scoring|réveil|reactivat|re-engage|re_engage|drip|cadence/i.test(n),
    suggestsScoring: /score|scoring|qualif|mql|sql/i.test(n),
    suggestsOnboarding: /onboard|welcome|bienvenue|first\s*step|kickoff|d[ée]marrage/i.test(n),
    suggestsChurnPrevention: /churn|attrition|risque|perte\s*client|win.?back/i.test(n),
    suggestsRenewal: /renew|renouv|reabonn/i.test(n),
    suggestsCrossSell: /upsell|cross.?sell|expansion|incremental/i.test(n),
    suggestsHandoff: /handoff|hand.?over|attribution|assign|round.?robin|owner|attrib\./i.test(n),
    isAllCaps: name === name.toUpperCase() && name.length > 5 && /[A-Z]/.test(name),
  };
}

// ── Helpers temporels ─────────────────────────────────────────────────

function monthsSince(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!t) return 0;
  return Math.round((Date.now() - t) / (30 * 86_400_000));
}

function fmtMonths(m: number): string {
  if (m < 1) return "moins d'1 mois";
  if (m < 12) return `${m} mois`;
  const years = Math.floor(m / 12);
  const remMonths = m % 12;
  return remMonths > 0 ? `${years} an${years > 1 ? "s" : ""} et ${remMonths} mois` : `${years} an${years > 1 ? "s" : ""}`;
}

// ── Audit principal ───────────────────────────────────────────────────

export function buildBasicWorkflowAudit(w: WorkflowMeta): WorkflowRecommendation[] {
  const recos: WorkflowRecommendation[] = [];
  const sig = analyzeName(w.name);
  const ageMonths = monthsSince(w.createdAt);
  const lastModMonths = monthsSince(w.updatedAt);
  const revs = w.revisionId ?? 0;

  // ═══ ANTI-PATTERNS NOM ═══

  if (sig.isTest && w.enabled) {
    recos.push({
      severity: "warning",
      title: "🧪 Workflow de test marqué actif en production",
      body: `Le nom « ${w.name} » suggère un workflow de test (test/draft/wip/brouillon). Il tourne actuellement sur des contacts/deals réels — risque d'effets de bord (mails non voulus, propriétés modifiées, etc.).`,
      recommendation: "Si c'est vraiment un test : désactiver immédiatement OU le supprimer. Si c'est devenu un workflow de production : le renommer pour enlever l'ambiguïté.",
    });
  }

  if (sig.isOld) {
    recos.push({
      severity: w.enabled ? "warning" : "info",
      title: "📦 Workflow marqué obsolète",
      body: `Le nom contient un marqueur d'obsolescence (« [OLD] », « à supprimer », « ancien »). ${w.enabled ? "Il est encore ACTIF — risque de déclencher des actions sur des données obsolètes." : "Il est inactif mais pollue la liste."}`,
      recommendation: w.enabled
        ? "Désactiver d'abord, vérifier qu'aucune dépendance ne casse (workflows enchaînés, segments, alertes), puis archiver."
        : "Archiver définitivement pour nettoyer la console workflows HubSpot.",
    });
  }

  if (sig.isCopy && lastModMonths < 1) {
    recos.push({
      severity: "info",
      title: "📋 Workflow copié — vérifier la finalisation",
      body: `Le nom commence par « Copy of » ou « Copie de » et a été modifié récemment. C'est probablement un brouillon en cours de personnalisation.`,
      recommendation: "Renommer pour refléter l'intention business (le préfixe \"Copy of\" pollue), vérifier que les actions ont été adaptées au nouveau contexte (ne pas dupliquer aveuglément un workflow existant).",
    });
  }

  if (sig.isAllCaps) {
    recos.push({
      severity: "info",
      title: "📣 Nom en MAJUSCULES",
      body: `Le nom est entièrement en majuscules (« ${w.name} »). Convention typographique souvent utilisée pour signaler un workflow critique ou prioritaire.`,
      recommendation: "Standardiser une convention de nommage à l'échelle de l'org : ex. \"[CRITIQUE]\", \"[CORE]\" en préfixe pour les workflows essentiels, plutôt que MAJUSCULES qui ne s'aligne pas avec les autres.",
    });
  }

  // ═══ CYCLE DE VIE TEMPOREL ═══

  if (w.enabled && lastModMonths >= 6) {
    recos.push({
      severity: lastModMonths >= 18 ? "warning" : "info",
      title: `🕰️ Workflow actif sans modification depuis ${fmtMonths(lastModMonths)}`,
      body: `Ce workflow tourne depuis ${fmtMonths(lastModMonths)} sans aucune révision. À cet âge, le risque est qu'il pollue la donnée (action sur un stage qui n'existe plus, propriété renommée, lifecycle stage obsolète) ou rate des cas modernes (nouveaux pipelines, nouveaux owners).`,
      recommendation: "Audit RevOps trimestriel : (1) le déclencheur est-il encore pertinent ? (2) les actions touchent-elles des propriétés/stages qui existent encore ? (3) le KPI mesuré est-il encore suivi ? Si oui → toucher le workflow pour mettre à jour updatedAt et trace de revue.",
    });
  }

  if (!w.enabled && revs <= 1 && ageMonths > 1) {
    recos.push({
      severity: "warning",
      title: "💀 Workflow abandonné (créé puis jamais activé)",
      body: `Créé il y a ${fmtMonths(ageMonths)}, ${revs} révision, jamais activé. C'est probablement un brouillon abandonné qui pollue la console workflows et perturbe la lisibilité.`,
      recommendation: "Supprimer définitivement OU finaliser et activer. Laisser des brouillons inactifs traîner = dette technique RevOps qui s'accumule au fil des années.",
    });
  }

  if (revs > 30) {
    recos.push({
      severity: "warning",
      title: `⚙️ Workflow très instable (${revs} révisions)`,
      body: `Ce workflow a été modifié ${revs} fois. Soit il évolue avec le business (signe d'un workflow vivant et utilisé), soit il est mal défini et change tout le temps (signe d'un manque de clarté business).`,
      recommendation: "Vérifier l'historique des modifications dans HubSpot (qui modifie, quand, quoi). Si > 5 personnes ont touché le workflow sans gouvernance : nommer un seul owner. Si le workflow change tous les mois : c'est qu'il devrait probablement être splitté en plusieurs workflows plus stables.",
    });
  }

  if (revs <= 1 && ageMonths > 6 && w.enabled) {
    recos.push({
      severity: "info",
      title: "🪦 Workflow « set & forget »",
      body: `Créé il y a ${fmtMonths(ageMonths)}, jamais modifié depuis (${revs} révision). C'est soit un workflow parfait du premier coup, soit un workflow qu'on a oublié et qui tourne en silence.`,
      recommendation: "Audit ponctuel : ouvrir le workflow, lister ses actions, vérifier qu'elles correspondent au business actuel. Si OK : ajouter une note interne datée pour acter la revue. Sinon : le mettre à jour.",
    });
  }

  // ═══ HEURISTIQUES PAR INTENT (depuis le nom) ═══

  if (sig.suggestsReenrollment && w.enabled) {
    recos.push({
      severity: "info",
      title: "🔁 Workflow probable de relance / nurturing",
      body: `Le nom suggère un workflow de relance, nurturing ou scoring. Ces workflows sont presque toujours censés enrôler un même contact plusieurs fois (ex: contact qui retombe en MQL → re-rentrer dans le scoring).`,
      recommendation: "Vérifier que le re-enrollment est ACTIVÉ dans HubSpot (Settings → Re-enrollment). Sinon les contacts qui sortent du workflow ne pourront plus jamais y revenir, même s'ils retombent dans les critères. C'est l'erreur RevOps la plus fréquente sur ce type de workflow.",
    });
  }

  if (sig.suggestsOnboarding && w.enabled) {
    recos.push({
      severity: "info",
      title: "🎯 Workflow probable d'onboarding",
      body: `Le nom suggère un workflow d'onboarding (welcome, bienvenue, first step, démarrage). Ces workflows ont un objectif précis : amener le contact à un état défini (ex: première connexion, premier achat).`,
      recommendation: "Vérifier qu'un GOAL est paramétré dans HubSpot (sortie auto sur condition atteinte). Sinon les contacts s'accumulent dans le workflow indéfiniment et faussent les métriques d'onboarding.",
    });
  }

  if (sig.suggestsHandoff && w.enabled) {
    recos.push({
      severity: "info",
      title: "🤝 Workflow probable d'attribution / handoff",
      body: `Le nom suggère un workflow d'attribution ou de round-robin. Ces workflows définissent QUI gère QUOI dans l'équipe — leur fiabilité conditionne directement le SLA commercial.`,
      recommendation: "Audit critique : (1) tous les owners du round-robin sont-ils encore actifs et présents ? (2) les filters d'attribution couvrent-ils 100% des cas (sinon des leads tombent sans owner) ? (3) un workflow d'alerte tourne-t-il en parallèle pour signaler les contacts non attribués ?",
    });
  }

  if (sig.suggestsChurnPrevention || sig.suggestsRenewal) {
    recos.push({
      severity: "info",
      title: `${sig.suggestsRenewal ? "🔄" : "🚪"} Workflow probable de ${sig.suggestsRenewal ? "renouvellement" : "prévention churn"}`,
      body: `Le nom suggère un workflow lié à la rétention client. Ces workflows tournent sur des comptes existants — la précision compte plus que la couverture (mieux vaut rater un cas que faire fuir un client par sur-sollicitation).`,
      recommendation: "Vérifier dans HubSpot : (1) les filters excluent-ils les contacts qui ont déjà reçu une comm CSM récente ? (2) les actions sont-elles assignées au CSM responsable du compte plutôt qu'à un email générique ? (3) les goals sont-ils paramétrés (renouvellement signé, cross-sell créé) ?",
    });
  }

  if (sig.suggestsCrossSell && w.enabled) {
    recos.push({
      severity: "info",
      title: "📈 Workflow probable d'upsell / cross-sell",
      body: `Le nom suggère un workflow d'expansion revenue (upsell / cross-sell). Ces workflows ont un fort impact direct sur le NRR — leur fiabilité doit être audité régulièrement.`,
      recommendation: "Mesurer dans HubSpot le taux de conversion réel (deals créés depuis ce workflow / contacts enrôlés) sur les 90 derniers jours. Si < 5% : revoir le ciblage. Si trop large : segmenter par taille de compte / produit.",
    });
  }

  // ═══ HEURISTIQUES PAR OBJET ═══

  if (w.objectType === "deal" && w.enabled) {
    recos.push({
      severity: "info",
      title: "💼 Workflow sur Deals",
      body: `Workflow sur l'objet Deal = automation de pipeline. Ces workflows sont sensibles : ils peuvent déclencher des emails commerciaux, modifier des stages, créer des tâches pour les sales — chaque action a un impact direct sur le forecast.`,
      recommendation: "Checklist deal workflow : (1) un GOAL est paramétré (sinon deals accumulés indéfiniment) ; (2) les filters distinguent bien les pipelines (un workflow par pipeline si possible, sinon scope explicite) ; (3) les actions ne touchent pas à dealstage automatiquement (anti-pattern : casse l'historique de transitions).",
    });
  }

  if (w.objectType === "ticket" && w.enabled) {
    recos.push({
      severity: "info",
      title: "🎧 Workflow sur Tickets",
      body: `Workflow sur l'objet Ticket = automation de Service Hub. Ces workflows définissent le SLA et l'escalade — leur fiabilité conditionne la satisfaction client mesurée par CSAT/NPS.`,
      recommendation: "Vérifier : (1) les délais d'escalade correspondent-ils encore au SLA contractuel actuel ? (2) les destinataires des escalades sont-ils tous encore présents dans l'équipe ? (3) un workflow miroir tourne-t-il sur les conversations (chat/email entrants non traités) ?",
    });
  }

  if (w.objectType === "custom" && w.enabled) {
    recos.push({
      severity: "info",
      title: "🧩 Workflow sur Custom Object",
      body: `Workflow sur un Custom Object (objet métier propre à votre business). Ces workflows sont avancés et critiques car ils gèrent des process spécifiques non couverts par les objets natifs HubSpot.`,
      recommendation: "Documenter en interne : (1) à quoi sert cet objet, (2) qui le gère, (3) ce que fait ce workflow précisément, (4) qui est responsable de sa maintenance. Sans documentation, ces workflows deviennent des boîtes noires intransférables au départ d'un employé.",
    });
  }

  if (w.objectType === "lead" && w.enabled) {
    recos.push({
      severity: "info",
      title: "🌱 Workflow sur Leads (objet HubSpot Lead)",
      body: `Workflow sur l'objet Lead — le nouveau funnel marketing/sales handoff de HubSpot. Ces workflows pilotent le scoring et la qualification avant création du contact/deal.`,
      recommendation: "Vérifier l'alignement avec le SDR : le seuil de qualification (lead → contact + deal) est-il documenté ? Le SLA SDR pour traiter un lead qualifié est-il mesuré (response time) ?",
    });
  }

  // ═══ FLOWTYPE SPÉCIFIQUE ═══

  if (w.flowType && w.flowType !== "WORKFLOW") {
    recos.push({
      severity: "info",
      title: `⚙️ Type de workflow non standard : ${w.flowType}`,
      body: `Ce workflow utilise le type "${w.flowType}" (au lieu du WORKFLOW classique). C'est probablement un calculation workflow, un workflow de propriété calculée, ou un workflow custom imported — types généralement non éditables via l'UI standard.`,
      recommendation: "Documenter le rôle exact : qui l'a créé (souvent un consultant externe), pour quel besoin, comment le maintenir. Ces workflows sont souvent des boîtes noires qui cassent silencieusement quand HubSpot évolue.",
    });
  }

  return recos;
}
