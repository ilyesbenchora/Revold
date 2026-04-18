/**
 * Génère un coaching ACTIONNABLE (titre + contexte + plan d'action concret)
 * à partir du KPI sélectionné dans un rapport et du headline d'analyse.
 *
 * Pensé comme un CRO/RevOps senior : chaque famille de KPI a un pattern
 * d'action standard (workflow à créer, propriété à pousser, intégration à
 * connecter, process à instaurer). C'est ce qui transforme une analyse
 * passive en plan d'exécution mesurable.
 */

import type { CoachingActionType } from "./coaching-types";

export type GeneratedCoaching = {
  title: string;
  body: string;
  recommendation: string;
  actionType: CoachingActionType;
};

function stripBold(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
}

export function generateCoachingAction(
  kpiLabel: string,
  headline: string,
  reportTitle?: string,
): GeneratedCoaching {
  const k = (kpiLabel || reportTitle || "").toLowerCase();
  const cleanedHeadline = stripBold(headline);

  // ── ATTRIBUTION / ORPHELINS ──
  if (k.includes("orphelin") || k.includes("sans owner") || k.includes("non attribué") || k.includes("attribution")) {
    return {
      title: "Mettre en place un workflow d'attribution automatique",
      body: `Constat : ${cleanedHeadline}. Chaque contact ou deal sans owner crée une dette commerciale invisible : aucun reporting par segment, aucune relance, aucune responsabilité.`,
      recommendation:
        "1) Créer un workflow HubSpot déclenché à la création (contact / deal) qui assigne un owner via round-robin par équipe ou par segment. " +
        "2) Définir une règle de fallback : escalade au manager si aucun owner disponible sous 24h. " +
        "3) Vérifier hebdomadairement que le taux d'orphelins reste < 5 %. " +
        "4) Lancer un sprint de rattrapage sur les orphelins existants > 30 jours.",
      actionType: "workflow",
    };
  }

  // ── CYCLE / VELOCITE ──
  if (k.includes("cycle") || k.includes("vélocité") || k.includes("durée") || k.includes("temps par étape")) {
    return {
      title: "Lancer un sprint de raccourcissement du cycle de vente",
      body: `Constat : ${cleanedHeadline}. Chaque jour gagné sur le cycle augmente directement la vélocité revenue. À l'inverse, un cycle qui s'allonge = pipeline qui pourrit.`,
      recommendation:
        "1) Sortir le rapport temps par stage et identifier le stage le plus lent. " +
        "2) Auditer les 10 deals les plus longs sur ce stage : décideur identifié ? validation interne bloquée ? next step défini ? " +
        "3) Créer un workflow d'alerte : tâche manager si un deal stagne > 21 jours sur le stage critique. " +
        "4) Coacher 1-1 chaque commercial sur le passage de ce stage (script + objections).",
      actionType: "workflow",
    };
  }

  // ── CONVERSION / DEPERDITION ──
  if (k.includes("taux de conversion") || k.includes("conversion") || k.includes("déperdition")) {
    return {
      title: "Audit du goulot de conversion + plan de coaching commercial",
      body: `Constat : ${cleanedHeadline}. Identifier précisément où les deals meurent silencieusement permet de récupérer ~10-20 % de CA sans augmenter le pipeline.`,
      recommendation:
        "1) Sortir le rapport de conversion par stage (vue Sankey ou funnel). " +
        "2) Identifier le stage avec la plus grosse déperdition (Lost / Total). " +
        "3) Coacher 1-1 chaque commercial sur ce stage : analyse de 5 deals perdus par owner. " +
        "4) Créer une checklist de qualification obligatoire pour passer ce stage (BANT, MEDDIC ou similaire). " +
        "5) Mesurer la conversion à 30 jours et 90 jours.",
      actionType: "process",
    };
  }

  // ── MEETINGS / RDV ──
  if (k.includes("meeting") || k.includes("rdv") || k.includes("rendez-vous")) {
    return {
      title: "Imposer un nombre minimum de meetings par deal",
      body: `Constat : ${cleanedHeadline}. En B2B, les deals avec 3+ meetings closent en moyenne 2,5× mieux que ceux à 1 seul RDV.`,
      recommendation:
        "1) Définir une règle interne : minimum 1 RDV de qualification + 1 RDV technique avant toute proposition commerciale. " +
        "2) Créer une propriété custom 'Nb de meetings' sur les deals, auto-incrémentée via workflow à chaque meeting loggé. " +
        "3) Bloquer (via validation) le passage au stage Proposition tant que cette propriété < 2. " +
        "4) Mesurer l'évolution du taux de closing par deal sur 60 jours.",
      actionType: "property",
    };
  }

  // ── APPELS ──
  if (k.includes("appel") || k.includes("call") || k.includes("téléphone")) {
    return {
      title: "Imposer un minimum d'appels par deal en early stage",
      body: `Constat : ${cleanedHeadline}. Le téléphone reste un levier de qualification supérieur à l'email en B2B — surtout sur les premiers stages.`,
      recommendation:
        "1) Imposer 3 appels minimum avant le passage au stage 30 %. " +
        "2) Créer un workflow qui crée automatiquement une tâche d'appel 48h après la création d'un deal. " +
        "3) Reviewer hebdomadaire des deals avec 0 appel logué : recoaching obligatoire. " +
        "4) Comparer le closing rate des commerciaux high-call vs low-call.",
      actionType: "workflow",
    };
  }

  // ── STAGNANT / BLOQUE ──
  if (k.includes("stagnant") || k.includes("bloqué") || k.includes("stage")) {
    return {
      title: "Plan de désencombrement pipeline + règles d'expiration auto",
      body: `Constat : ${cleanedHeadline}. Un pipeline encombré fausse le forecast au COMEX et démotive les équipes (deals zombies).`,
      recommendation:
        "1) Audit mensuel des deals > 60 jours sans activité : marquer Lost ou requalifier explicitement. " +
        "2) Créer un workflow qui marque automatiquement 'À risque' un deal stagnant > 30 jours sur un stage. " +
        "3) Reporting hebdomadaire des deals 'À risque' envoyé au manager. " +
        "4) KPI à suivre : ratio créés / closés (cible 1,5 - 2,5).",
      actionType: "workflow",
    };
  }

  // ── CA / MONTANT / FORECAST ──
  if (k.includes("ca ") || k.endsWith("ca") || k.includes("montant") || k.includes("(€)") || k.includes("pondéré") || k.includes("forecast")) {
    return {
      title: "Fiabiliser le forecast hebdo + revue COMEX",
      body: `Constat : ${cleanedHeadline}. Un forecast non fiable mine la confiance du board et dégrade la planification capacitaire.`,
      recommendation:
        "1) Imposer la mise à jour du montant deal et de la date de closing prévisionnelle à chaque revue 1-1. " +
        "2) Pondérer le pipeline par stage avec des coefficients calibrés sur les 6 derniers mois (pas les valeurs HubSpot par défaut). " +
        "3) Comparer forecast vs réalisé chaque fin de mois et ajuster les coefficients. " +
        "4) Bloquer (workflow) le passage en stage 50 % tant qu'aucun montant n'est renseigné.",
      actionType: "process",
    };
  }

  // ── ENRICHISSEMENT / QUALITE DONNEES / COMPLETUDE ──
  if (k.includes("enrichissement") || k.includes("complétude") || k.includes("qualité") || k.includes("score")) {
    return {
      title: "Plan d'enrichissement progressif + champs obligatoires à la création",
      body: `Constat : ${cleanedHeadline}. Sous 60 % de complétude, segmentation, scoring et reporting sont compromis — toute analyse devient discutable.`,
      recommendation:
        "1) Identifier les 5 propriétés les plus impactantes par objet (contacts / companies / deals). " +
        "2) Lancer un enrichissement ciblé sur les 500 contacts les plus récents (ou via un outil type Cognism / Lusha). " +
        "3) Rendre ces propriétés obligatoires à la création via les formulaires HubSpot et les écrans deal. " +
        "4) Reporting mensuel du taux de complétude par champ et par owner.",
      actionType: "property",
    };
  }

  // ── SOURCE / ACQUISITION / OFFLINE ──
  if (k.includes("source") || k.includes("acquisition") || k.includes("offline") || k.includes("organic") || k.includes("social")) {
    return {
      title: "Diversifier les canaux d'acquisition + tracking source obligatoire",
      body: `Constat : ${cleanedHeadline}. Une dépendance > 70 % sur un seul canal d'acquisition est un risque stratégique majeur (un changement d'algo, un canal qui sature, et le pipeline tombe).`,
      recommendation:
        "1) Créer une propriété 'Canal d'acquisition' obligatoire à la création contact (formulaire + workflow). " +
        "2) Allouer 20 % du budget marketing au canal le moins représenté pendant 1 trimestre. " +
        "3) Mesurer coût par lead par canal et revenue généré à 6 mois pour valider l'investissement. " +
        "4) Ajouter une vue 'mix d'acquisition' dans le dashboard COMEX mensuel.",
      actionType: "property",
    };
  }

  // ── LIFECYCLE / LEAD / FUNNEL ──
  if (k.includes("lifecycle") || k.includes("lead") || k.includes("opportunity") || k.includes("funnel")) {
    return {
      title: "Lead scoring HubSpot + SLA marketing → sales",
      body: `Constat : ${cleanedHeadline}. Un funnel sans qualification automatique laisse des leads mourir entre marketing et sales — c'est la fuite la plus coûteuse en B2B.`,
      recommendation:
        "1) Implémenter un lead scoring HubSpot basé sur l'engagement (ouvertures email + visites web + formulaires + ICP fit). " +
        "2) SLA premier contact < 24h entre passage MQL et premier appel commercial. " +
        "3) Workflow automatique : tout MQL non contacté sous 48h escalade au manager. " +
        "4) Purger les leads > 6 mois sans activité (réveil ou archivage).",
      actionType: "workflow",
    };
  }

  // ── FACTURATION / IMPAYE / ENCAISSEMENT ──
  if (k.includes("facture") || k.includes("facturation") || k.includes("encaiss") || k.includes("impayé") || k.includes("billing")) {
    return {
      title: "Automatiser la facturation au passage Closed Won",
      body: `Constat : ${cleanedHeadline}. Les écarts CRM ↔ facturation gonflent ou sous-estiment le revenue réel et créent du bruit en COMEX.`,
      recommendation:
        "1) Connecter Stripe (ou Pennylane / Sellsy) à HubSpot via une intégration native ou Zapier / Make. " +
        "2) Créer un workflow qui déclenche automatiquement la création de facture dès qu'un deal passe en Closed Won. " +
        "3) Alerte manager pour toute facture impayée > 30 jours. " +
        "4) Réconciliation mensuelle CRM vs facturé (objectif < 5 % d'écart).",
      actionType: "integration",
    };
  }

  // ── TICKETS / CSAT / SUPPORT ──
  if (k.includes("ticket") || k.includes("csat") || k.includes("réouverture") || k.includes("support")) {
    return {
      title: "SLA support + détection comptes à risque churn",
      body: `Constat : ${cleanedHeadline}. Un ticket non traité ou ré-ouvert = signal de churn imminent. Le coût d'acquisition d'un nouveau client est 5-7× supérieur à la rétention.`,
      recommendation:
        "1) Définir un SLA premier contact < 4h pour les tickets haute priorité. " +
        "2) Workflow automatique : escalade manager si SLA non respecté. " +
        "3) Croiser tickets ouverts × MRR pour identifier les comptes à protéger en priorité (Customer Success). " +
        "4) Reporting hebdo CSAT proxy + taux de réouverture par agent.",
      actionType: "workflow",
    };
  }

  // ── EMAIL / OUTBOUND / SEQUENCES ──
  if (k.includes("email") || k.includes("outbound") || k.includes("séquence") || k.includes("touchpoint")) {
    return {
      title: "Optimiser les séquences outbound + benchmarks par owner",
      body: `Constat : ${cleanedHeadline}. La discipline outbound est un multiplicateur direct de pipeline — particulièrement en début de cycle.`,
      recommendation:
        "1) Mesurer le taux de réponse par owner et par séquence (top 20 % vs reste). " +
        "2) Standardiser les 3 séquences les plus performantes comme template équipe. " +
        "3) Imposer un rythme minimum : 50 emails outbound / semaine / commercial junior. " +
        "4) Coacher les commerciaux sous la moyenne sur la personnalisation des messages d'entrée.",
      actionType: "process",
    };
  }

  // ── DOUBLONS / DATA INCOHERENCE ──
  if (k.includes("doublon") || k.includes("incohérent") || k.includes("orphelin")) {
    return {
      title: "Plan de déduplication + règles de prévention",
      body: `Constat : ${cleanedHeadline}. Les doublons faussent le forecast par compte et démultiplient les communications (risque RGPD + image).`,
      recommendation:
        "1) Lancer le merge HubSpot natif sur les doublons évidents (email, domaine, SIREN). " +
        "2) Créer une règle de validation à la création contact : refus si email déjà existant. " +
        "3) Audit mensuel des doublons par responsable. " +
        "4) Si > 5 % de doublons, envisager un outil de résolution d'entité (Insycle, Dedupely).",
      actionType: "data_model",
    };
  }

  // ── DEFAULT — fallback générique mais structuré ──
  const subject = kpiLabel || reportTitle || "ce KPI";
  return {
    title: `Plan d'action prioritaire sur « ${subject} »`,
    body: `Constat : ${cleanedHeadline}. Cette métrique nécessite une action structurée pour générer un impact mesurable sur le revenue.`,
    recommendation:
      "1) Identifier la cause racine en auditant les 5 derniers cas concrets. " +
      "2) Définir une action mesurable avec une deadline à 7 jours et un owner unique. " +
      "3) Mesurer l'impact en relisant ce KPI au prochain cycle. " +
      "4) Documenter dans un playbook équipe si l'action fonctionne, ou itérer sinon.",
    actionType: "process",
  };
}
