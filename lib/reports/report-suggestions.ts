/**
 * Report Suggestion Engine — single-source reports.
 *
 * Each report is generated from ONE tool category detected on the portal.
 * Reports are tagged with a displayCategory for the user-facing filter
 * (Prospection, Appels, Cycle de ventes, Facturation, Paiement, Qualité
 * de données, Adoption outils, Service client, Marketing).
 */

import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";

// Internal tool category (which tool drives the report)
export type ToolCategory =
  | "outbound" | "calling" | "enrichment" | "esign" | "billing"
  | "support" | "conv_intel" | "email_calendar" | "meetings"
  | "social_selling" | "other";

// User-facing display category for the filter pills
export type DisplayCategory =
  | "prospection" | "appels" | "cycle_ventes" | "facturation"
  | "paiement" | "qualite_donnees" | "adoption_outils"
  | "service_client" | "marketing";

const TOOL_CATEGORY: Record<string, ToolCategory> = {
  lemlist: "outbound", apollo: "outbound", salesloft: "outbound", lagrowthmachine: "outbound",
  aircall: "calling", ringover: "calling", justcall: "calling",
  kaspr: "enrichment", dropcontact: "enrichment", lusha: "enrichment", zoominfo: "enrichment",
  pandadoc: "esign", yousign: "esign", docusign: "esign",
  stripe: "billing", pennylane: "billing", sellsy: "billing", axonaut: "billing", quickbooks: "billing",
  intercom: "support", zendesk: "support", crisp: "support", freshdesk: "support",
  modjo: "conv_intel", gong: "conv_intel", chorus: "conv_intel",
  outlook: "email_calendar", gmail: "email_calendar", calendly: "email_calendar",
  zoom: "meetings",
  linkedin: "social_selling", linkedin_sales_nav: "social_selling",
  mailchimp: "email_calendar", brevo: "email_calendar", activecampaign: "email_calendar",
  zapier: "other", make: "other", n8n: "other",
};

export type ReportSuggestion = {
  id: string;
  category: ToolCategory;
  displayCategory: DisplayCategory;
  title: string;
  description: string;
  metrics: string[];
  expectedValue: string;
  sourceIntegrations: Array<{ key: string; label: string; icon: string }>;
  priority: "high" | "medium" | "low";
  icon: string;
};

type ReportTemplate = Omit<ReportSuggestion, "id" | "sourceIntegrations">;

const REPORT_TEMPLATES: Record<ToolCategory, ReportTemplate[]> = {
  outbound: [
    {
      category: "outbound", displayCategory: "prospection",
      title: "Outbound → Opportunités → Deals gagnés",
      description: "Funnel complet : campagnes envoyées, taux de réponse, RDV pris, opportunités créées et CA généré par la stack outbound.",
      metrics: ["Emails envoyés / répondus", "Conversion réponse → meeting", "Opportunités créées par séquence", "Revenue attribué (€) par campagne"],
      expectedValue: "Mesurez le ROI réel de chaque séquence outbound.", priority: "high", icon: "📈",
    },
    {
      category: "outbound", displayCategory: "prospection",
      title: "Performance par SDR / commercial",
      description: "Classement des SDR sur volume, reply rate, meetings bookés et deals générés.",
      metrics: ["Activité (envois/jour)", "Reply rate", "Meetings booked", "Deals créés"],
      expectedValue: "Coaching ciblé et optimisation de la productivité.", priority: "high", icon: "🏆",
    },
  ],
  calling: [
    {
      category: "calling", displayCategory: "appels",
      title: "Activité d'appels → Pipeline",
      description: "Impact des appels sur la création et l'avancement des deals : volume, durée, taux de connexion, conversion.",
      metrics: ["Appels passés / décrochés", "Durée moyenne", "Deals créés après appel", "Conversion call → meeting"],
      expectedValue: "Identifiez les meilleurs créneaux et le bon nombre de tentatives.", priority: "high", icon: "📞",
    },
    {
      category: "calling", displayCategory: "appels",
      title: "Cadence d'appels par commercial",
      description: "Respect des objectifs d'activité quotidiens par SDR.",
      metrics: ["Appels/jour par user", "Taux de joignabilité", "Tentatives par lead"],
      expectedValue: "Volume d'activité constant et data-driven.", priority: "medium", icon: "⏱️",
    },
  ],
  enrichment: [
    {
      category: "enrichment", displayCategory: "qualite_donnees",
      title: "ROI de l'enrichissement de données",
      description: "Compare contacts enrichis vs non-enrichis : conversion, vélocité et CA pour mesurer la valeur de l'enrichissement.",
      metrics: ["% contacts enrichis", "Conversion enrichi vs non-enrichi", "CA moyen sur deals enrichis"],
      expectedValue: "Justifiez l'investissement en enrichissement.", priority: "high", icon: "💎",
    },
    {
      category: "enrichment", displayCategory: "qualite_donnees",
      title: "Santé de la base contacts",
      description: "Champs critiques manquants, doublons, contacts orphelins — pilote la qualité de la donnée.",
      metrics: ["Complétude des champs", "Taux de doublons", "Contacts sans entreprise"],
      expectedValue: "Base CRM fiable, segmentation marketing efficace.", priority: "medium", icon: "🧹",
    },
  ],
  esign: [
    {
      category: "esign", displayCategory: "cycle_ventes",
      title: "Cycle de signature → Time-to-close",
      description: "Délai envoi → signature, blocages systémiques et efficacité par commercial.",
      metrics: ["Temps moyen envoi → signature", "Taux de signature", "Contrats abandonnés", "Délai par commercial"],
      expectedValue: "Réduisez le cycle de vente et augmentez le taux de closing.", priority: "high", icon: "📝",
    },
  ],
  billing: [
    {
      category: "billing", displayCategory: "facturation",
      title: "Réconciliation Deals gagnés ↔ Factures",
      description: "Croise les opportunités fermées avec les factures réelles et fait apparaître les écarts forecast vs réalisé.",
      metrics: ["CA forecast vs réalisé", "Délai paiement moyen", "Deals gagnés sans facture", "Factures impayées"],
      expectedValue: "Forecast fiable et visibilité réelle sur le cash.", priority: "high", icon: "💳",
    },
    {
      category: "billing", displayCategory: "paiement",
      title: "MRR / ARR & churn par cohorte",
      description: "Suivi des revenus récurrents, expansion, contraction et churn par cohorte client.",
      metrics: ["MRR / ARR", "Net revenue retention", "Churn rate", "Expansion revenue"],
      expectedValue: "Pilotez la santé du business récurrent.", priority: "high", icon: "📊",
    },
    {
      category: "billing", displayCategory: "paiement",
      title: "Taux de succès des paiements",
      description: "Volume de paiements traités, taux de succès, échecs et montants en souffrance.",
      metrics: ["Paiements réussis / échoués", "Taux de succès (%)", "Montant en échec", "Dunning recovery rate"],
      expectedValue: "Réduisez les échecs de paiement et le churn involontaire.", priority: "high", icon: "💰",
    },
  ],
  support: [
    {
      category: "support", displayCategory: "service_client",
      title: "Tickets support → Risque de churn",
      description: "Croise volume et sentiment des tickets avec les renouvellements pour anticiper les comptes à risque.",
      metrics: ["Tickets / compte", "Temps de résolution", "Tickets ouverts à 30j du renew"],
      expectedValue: "Détection précoce du churn, action CSM proactive.", priority: "high", icon: "🎧",
    },
    {
      category: "support", displayCategory: "service_client",
      title: "Performance du service client",
      description: "Temps de première réponse, résolution, CSAT proxy et volume par canal.",
      metrics: ["1ère réponse (h)", "Résolution (h)", "CSAT proxy (%)", "Tickets par canal"],
      expectedValue: "Améliorer la satisfaction et réduire le temps de résolution.", priority: "medium", icon: "⚡",
    },
  ],
  conv_intel: [
    {
      category: "conv_intel", displayCategory: "cycle_ventes",
      title: "Analyse des appels gagnants vs perdus",
      description: "Compare les patterns conversationnels entre deals gagnés et perdus.",
      metrics: ["Talk ratio", "Objections détectées", "Next steps clarifiés", "Sentiment"],
      expectedValue: "Coaching commercial data-driven.", priority: "medium", icon: "🎙️",
    },
  ],
  email_calendar: [
    {
      category: "email_calendar", displayCategory: "marketing",
      title: "Activité email & meetings → Vélocité",
      description: "Nombre d'emails et meetings logés par deal, corrélation avec la probabilité de gain.",
      metrics: ["Emails / deal", "Meetings / deal", "Touch points avant gain"],
      expectedValue: "Combien de touches pour gagner un deal.", priority: "medium", icon: "📨",
    },
    {
      category: "email_calendar", displayCategory: "marketing",
      title: "Performance des campagnes email",
      description: "Taux d'ouverture, clics, désabonnements et impact sur le pipeline commercial.",
      metrics: ["Taux d'ouverture", "Taux de clic", "Désabonnements", "Deals générés par campagne"],
      expectedValue: "Identifiez les campagnes qui créent du pipeline.", priority: "high", icon: "📧",
    },
  ],
  meetings: [
    {
      category: "meetings", displayCategory: "cycle_ventes",
      title: "Conversion meetings → Opportunités",
      description: "Impact des meetings sur la création et la progression des deals.",
      metrics: ["Meetings tenus", "Conversion meeting → opp", "Show-up rate"],
      expectedValue: "Optimisez le ratio meetings / résultats.", priority: "medium", icon: "📅",
    },
  ],
  social_selling: [
    {
      category: "social_selling", displayCategory: "prospection",
      title: "Social Selling → Pipeline",
      description: "Impact des actions LinkedIn sur la création d'opportunités.",
      metrics: ["Connexions acceptées", "Réponses InMail", "Opportunités générées"],
      expectedValue: "Justifiez l'investissement Sales Navigator.", priority: "medium", icon: "💼",
    },
  ],
  other: [],
};

// Always-available reports (not tied to a specific detected tool)
const ALWAYS_AVAILABLE_REPORTS: ReportTemplate[] = [
  {
    category: "other", displayCategory: "adoption_outils",
    title: "Adoption du stack par utilisateur",
    description: "Pour chaque commercial, quels outils il utilise (Aircall, Kaspr, PandaDoc, Mailchimp…) et lesquels sont sous-exploités.",
    metrics: ["% adoption par outil et user", "Top 3 outils sous-utilisés", "Users à former en priorité", "Score d'adoption global"],
    expectedValue: "Maximiser le ROI de la stack en adressant la conduite du changement.", priority: "medium", icon: "👥",
  },
  {
    category: "other", displayCategory: "adoption_outils",
    title: "Évolution de l'adoption dans le temps",
    description: "Courbe d'adoption de chaque outil métier connecté semaine après semaine — détecte les tools abandonnés.",
    metrics: ["Adoption semaine N vs N-1", "Outils en croissance", "Outils en déclin", "Taux d'adoption global"],
    expectedValue: "Anticiper le désengagement et agir avant la perte du ROI.", priority: "medium", icon: "📈",
  },
  {
    category: "other", displayCategory: "qualite_donnees",
    title: "Audit de complétude des champs CRM",
    description: "Pour chaque champ critique (email, téléphone, entreprise, titre, SIREN), quel % est rempli et par quelle source.",
    metrics: ["Complétude par champ (%)", "Source principale par champ", "Champs prioritaires à enrichir"],
    expectedValue: "Prioriser l'enrichissement sur les champs qui impactent le plus le business.", priority: "high", icon: "🔍",
  },
  {
    category: "other", displayCategory: "cycle_ventes",
    title: "Vélocité du cycle de vente",
    description: "Temps moyen par étape de pipeline, identification des goulots d'étranglement et comparaison par commercial.",
    metrics: ["Jours par étape", "Étapes les plus rapides", "Étapes stagnantes (>21j)", "Vélocité par commercial"],
    expectedValue: "Raccourcir le cycle de vente en supprimant les points de friction.", priority: "high", icon: "⚡",
  },
];

const DISPLAY_CATEGORY_LABELS: Record<DisplayCategory, string> = {
  prospection: "Prospection",
  appels: "Appels",
  cycle_ventes: "Cycle de ventes",
  facturation: "Facturation",
  paiement: "Paiement",
  qualite_donnees: "Qualité de données",
  adoption_outils: "Adoption outils",
  service_client: "Service client",
  marketing: "Marketing",
};

export function getDisplayCategoryLabel(cat: DisplayCategory): string {
  return DISPLAY_CATEGORY_LABELS[cat] ?? cat;
}

export function getToolCategory(integrationKey: string): ToolCategory {
  return TOOL_CATEGORY[integrationKey] || "other";
}

export function getCategoryLabel(cat: ToolCategory): string {
  return DISPLAY_CATEGORY_LABELS[cat as unknown as DisplayCategory] ?? cat;
}

export function getReportSuggestions(
  integrations: DetectedIntegration[],
): ReportSuggestion[] {
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
      suggestions.push({ ...tpl, id: `${cat}_${idx}`, sourceIntegrations: sources });
    });
  }

  // Always-available reports (not tied to a detected tool)
  for (const tpl of ALWAYS_AVAILABLE_REPORTS) {
    suggestions.push({
      ...tpl,
      id: `always_${tpl.displayCategory}_${tpl.title.slice(0, 20).replace(/\W/g, "_")}`,
      sourceIntegrations: [],
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
}

export { DISPLAY_CATEGORY_LABELS };
export type { DisplayCategory as ReportDisplayCategory };
