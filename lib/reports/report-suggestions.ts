/**
 * Report Suggestion Engine
 *
 * Given the integrations detected on the customer's HubSpot, generates a
 * curated list of report templates that Revold could build to bring out
 * the value of each connected business tool.
 *
 * Goal: turn raw integration signals into "actionable" reports — outbound
 * to won deals, billing reconciliation, call analytics, e-sign cycle time,
 * etc. — so the user understands the ROI of having these tools connected.
 */

import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";

// Functional category of a tool (drives which reports we suggest)
export type ToolCategory =
  | "outbound"          // Cold email & prospection automation
  | "calling"           // Téléphonie
  | "enrichment"        // Data enrichment
  | "esign"             // Signature électronique
  | "billing"           // Facturation, ERP, paiement
  | "support"           // Service client / ticketing
  | "conv_intel"        // Conversational intelligence
  | "email_calendar"    // Outlook / Gmail / Calendly
  | "meetings"          // HubSpot Meetings / Zoom
  | "social_selling"    // LinkedIn / Sales Nav
  | "other";

const TOOL_CATEGORY: Record<string, ToolCategory> = {
  // Outbound / Prospection
  lemlist: "outbound",
  apollo: "outbound",
  salesloft: "outbound",
  lagrowthmachine: "outbound",
  // Calling
  aircall: "calling",
  ringover: "calling",
  justcall: "calling",
  // Enrichment
  kaspr: "enrichment",
  dropcontact: "enrichment",
  lusha: "enrichment",
  zoominfo: "enrichment",
  // E-signature
  pandadoc: "esign",
  yousign: "esign",
  docusign: "esign",
  // Billing / ERP
  stripe: "billing",
  pennylane: "billing",
  sellsy: "billing",
  axonaut: "billing",
  quickbooks: "billing",
  // Support
  intercom: "support",
  zendesk: "support",
  crisp: "support",
  // Conversational intelligence
  modjo: "conv_intel",
  gong: "conv_intel",
  chorus: "conv_intel",
  // Email & calendar
  outlook: "email_calendar",
  gmail: "email_calendar",
  calendly: "email_calendar",
  // Meetings & visio
  zoom: "meetings",
  // Social selling
  linkedin: "social_selling",
  linkedin_sales_nav: "social_selling",
};

export type ReportSuggestion = {
  id: string;
  category: ToolCategory;
  title: string;
  description: string;
  metrics: string[];               // KPIs the report would surface
  expectedValue: string;           // ROI / business impact
  sourceIntegrations: Array<{ key: string; label: string; icon: string }>;
  priority: "high" | "medium" | "low";
  icon: string;
};

type ReportTemplate = Omit<ReportSuggestion, "id" | "sourceIntegrations">;

const REPORT_TEMPLATES: Record<ToolCategory, ReportTemplate[]> = {
  outbound: [
    {
      category: "outbound",
      title: "Outbound → Opportunités → Deals gagnés",
      description:
        "Reconstitue le funnel complet : campagnes envoyées, taux de réponse, RDV pris, opportunités créées et chiffre d'affaires généré par votre stack outbound.",
      metrics: [
        "Nb d'emails envoyés / répondus",
        "Conversion réponse → meeting",
        "Opportunités créées par séquence",
        "Revenue attribué (€) par campagne",
      ],
      expectedValue: "Mesurez le ROI réel de chaque séquence outbound et identifiez les meilleures.",
      priority: "high",
      icon: "📈",
    },
    {
      category: "outbound",
      title: "Performance par SDR / commercial",
      description:
        "Classement des SDR sur volume envoyé, taux de réply, RDV pris et deals générés. Détecte les top performers et ceux qui ont besoin de coaching.",
      metrics: ["Activité (envois/jour)", "Reply rate", "Meetings booked", "Deals créés"],
      expectedValue: "Coaching ciblé et optimisation de la productivité commerciale.",
      priority: "high",
      icon: "🏆",
    },
  ],
  calling: [
    {
      category: "calling",
      title: "Activité téléphonique → Pipeline",
      description:
        "Analyse de l'impact des appels sur la création et l'avancement des deals : nb d'appels, durée moyenne, taux de connexion et conversion vers deals.",
      metrics: [
        "Appels passés / décrochés",
        "Durée moyenne de conversation",
        "Deals créés après appel",
        "Conversion call → meeting",
      ],
      expectedValue: "Identifiez les meilleurs créneaux d'appel et le bon nombre de tentatives par lead.",
      priority: "high",
      icon: "📞",
    },
    {
      category: "calling",
      title: "Suivi de cadence d'appels par commercial",
      description:
        "Tableau de bord des cadences d'appels par SDR/commercial pour s'assurer du respect des objectifs d'activité quotidiens.",
      metrics: ["Appels/jour par user", "Taux de joignabilité", "Tentatives par lead"],
      expectedValue: "Garantir un volume d'activité constant et data-driven.",
      priority: "medium",
      icon: "⏱️",
    },
  ],
  enrichment: [
    {
      category: "enrichment",
      title: "ROI de l'enrichissement de données",
      description:
        "Compare les contacts/sociétés enrichis vs non-enrichis : taux de conversion, vélocité commerciale et CA généré pour mesurer la valeur de l'enrichissement.",
      metrics: [
        "% contacts enrichis",
        "Conversion enrichi vs non-enrichi",
        "CA moyen sur deals enrichis",
      ],
      expectedValue: "Justifiez l'investissement en outils d'enrichissement avec des chiffres.",
      priority: "high",
      icon: "💎",
    },
    {
      category: "enrichment",
      title: "Qualité de la base contacts",
      description:
        "État de santé de la base : champs critiques manquants, doublons, contacts orphelins. Pilote la conduite du changement sur la qualité de la donnée.",
      metrics: ["Complétude des champs", "Taux de doublons", "Contacts sans entreprise"],
      expectedValue: "Base CRM fiable, segmentation marketing efficace.",
      priority: "medium",
      icon: "🧹",
    },
  ],
  esign: [
    {
      category: "esign",
      title: "Cycle de signature → Time-to-close",
      description:
        "Mesure le délai entre l'envoi du contrat et la signature, identifie les blocages et les commerciaux les plus efficaces sur la phase de closing.",
      metrics: [
        "Temps moyen envoi → signature",
        "Taux de signature",
        "Contrats abandonnés",
        "Délai par commercial",
      ],
      expectedValue: "Réduisez le cycle de vente et augmentez le taux de transformation closing.",
      priority: "high",
      icon: "📝",
    },
  ],
  billing: [
    {
      category: "billing",
      title: "Réconciliation Deals gagnés ↔ Factures encaissées",
      description:
        "Croise automatiquement les opportunités fermées dans HubSpot avec les factures et paiements réels, et fait apparaître les écarts (CA forecasté vs réalisé).",
      metrics: [
        "CA forecast vs réalisé",
        "Délai paiement moyen",
        "Deals gagnés sans facture",
        "Factures impayées",
      ],
      expectedValue: "Forecast fiable et visibilité réelle sur le cash, pas seulement le pipeline.",
      priority: "high",
      icon: "💳",
    },
    {
      category: "billing",
      title: "MRR / ARR & churn par cohorte",
      description:
        "Pour les modèles SaaS/abonnement : suivi des revenus récurrents, expansion, contraction et churn par cohorte client.",
      metrics: ["MRR / ARR", "Net revenue retention", "Churn rate", "Expansion revenue"],
      expectedValue: "Pilotez la santé du business récurrent dans Revold, plus besoin d'export Excel.",
      priority: "high",
      icon: "📊",
    },
  ],
  support: [
    {
      category: "support",
      title: "Tickets support → Risque de churn",
      description:
        "Croise volume et sentiment des tickets support avec les renouvellements pour anticiper le churn des comptes à risque.",
      metrics: ["Tickets / compte", "Temps de résolution", "Tickets ouverts à 30j du renew"],
      expectedValue: "Détection précoce des churns, action proactive de la CSM.",
      priority: "medium",
      icon: "🎧",
    },
  ],
  conv_intel: [
    {
      category: "conv_intel",
      title: "Analyse des appels gagnants vs perdus",
      description:
        "Compare les patterns conversationnels (talk ratio, objections, mots-clés) entre les appels qui ont mené à un deal gagné et ceux perdus.",
      metrics: ["Talk ratio", "Objections détectées", "Next steps clarifiés", "Sentiment"],
      expectedValue: "Coaching commercial data-driven, méthode de vente affinée.",
      priority: "medium",
      icon: "🎙️",
    },
  ],
  email_calendar: [
    {
      category: "email_calendar",
      title: "Activité email & meetings → Vélocité commerciale",
      description:
        "Mesure le nombre d'emails et de meetings logés par deal, et corrèle avec la probabilité de gain et la vélocité.",
      metrics: ["Emails / deal", "Meetings / deal", "Touch points avant gain"],
      expectedValue: "Combien de touches sont vraiment nécessaires pour gagner un deal.",
      priority: "low",
      icon: "📨",
    },
  ],
  meetings: [
    {
      category: "meetings",
      title: "Conversion meetings → Opportunités",
      description:
        "Suivi des meetings logés et de leur impact sur la création d'opportunités et la progression des deals.",
      metrics: ["Meetings tenus", "Conversion meeting → opp", "Show-up rate"],
      expectedValue: "Optimisez le ratio meetings / résultats commerciaux.",
      priority: "low",
      icon: "📅",
    },
  ],
  social_selling: [
    {
      category: "social_selling",
      title: "Social Selling → Pipeline",
      description:
        "Mesure l'impact des actions LinkedIn (connexions, messages, InMails) sur la création d'opportunités et de pipeline.",
      metrics: ["Connexions acceptées", "Réponses InMail", "Opportunités générées"],
      expectedValue: "Justifiez l'investissement Sales Navigator avec des résultats concrets.",
      priority: "medium",
      icon: "💼",
    },
  ],
  other: [],
};

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  outbound: "Cold Email & Prospection",
  calling: "Téléphonie",
  enrichment: "Enrichissement & Data",
  esign: "Signature électronique",
  billing: "Facturation & ERP",
  support: "Service client",
  conv_intel: "Conversational Intelligence",
  email_calendar: "Email & Agenda",
  meetings: "Meetings & Visio",
  social_selling: "Social Selling",
  other: "Autres",
};

export function getCategoryLabel(cat: ToolCategory): string {
  return CATEGORY_LABELS[cat];
}

export function getToolCategory(integrationKey: string): ToolCategory {
  return TOOL_CATEGORY[integrationKey] || "other";
}

/**
 * Build report suggestions for the detected integrations.
 * Each report aggregates source integrations of the same category so we don't
 * duplicate suggestions when the user has e.g. both Aircall and Ringover.
 */
export function getReportSuggestions(
  integrations: DetectedIntegration[],
): ReportSuggestion[] {
  // Group integrations by functional category
  const byCategory = new Map<ToolCategory, DetectedIntegration[]>();
  for (const int of integrations) {
    const cat = getToolCategory(int.key);
    if (cat === "other") continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(int);
  }

  const suggestions: ReportSuggestion[] = [];
  for (const [cat, ints] of byCategory.entries()) {
    const templates = REPORT_TEMPLATES[cat] || [];
    const sources = ints.map((i) => ({ key: i.key, label: i.label, icon: i.icon }));
    templates.forEach((tpl, idx) => {
      suggestions.push({
        ...tpl,
        id: `${cat}_${idx}`,
        sourceIntegrations: sources,
      });
    });
  }

  // Sort: high priority first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
}

export { CATEGORY_LABELS };
