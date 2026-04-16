import { detectIntegrations, type DetectedIntegration } from "@/lib/integrations/detect-integrations";

// ── Types ──

export type ToolCategory =
  | "outbound" | "calling" | "enrichment" | "billing" | "support"
  | "conv_intel" | "email_calendar" | "meetings" | "social_selling" | "esign" | "other";

export type DisplayCategory =
  | "attribution" | "chiffre_affaires" | "facturation_paiement"
  | "service_client" | "qualite_donnees" | "adoption_outils" | "cycle_ventes"
  | "activite_commerciale" | "pipeline_analyse";

export const DISPLAY_CATEGORY_LABELS: Record<DisplayCategory, string> = {
  attribution: "Attribution",
  chiffre_affaires: "Chiffre d'affaires",
  facturation_paiement: "Facturation & Paiement",
  service_client: "Service client",
  qualite_donnees: "Qualité de données",
  adoption_outils: "Adoption outils",
  cycle_ventes: "Cycle de ventes",
  activite_commerciale: "Activité commerciale",
  pipeline_analyse: "Analyse pipeline",
};

export type ReportTemplate = {
  category: ToolCategory;
  displayCategory: DisplayCategory;
  title: string;
  description: string;
  metrics: string[];
  expectedValue: string;
  priority: "high" | "medium" | "low";
  icon: string;
};

export type ReportSuggestion = ReportTemplate & {
  id: string;
  sourceIntegrations: Array<{ key: string; label: string; icon: string }>;
  reliabilityPct: number;
  requiredCategories?: ToolCategory[];
};

// ── Tool category detection ──

export function getToolCategory(key: string): ToolCategory {
  const map: Record<string, ToolCategory> = {
    lemlist: "outbound", apollo: "outbound", salesloft: "outbound", outreach: "outbound", woodpecker: "outbound",
    aircall: "calling", ringover: "calling", dialpad: "calling",
    kaspr: "enrichment", dropcontact: "enrichment", clearbit: "enrichment", zoominfo: "enrichment",
    stripe: "billing", pennylane: "billing", qonto: "billing", chargebee: "billing",
    zendesk: "support", intercom: "support", freshdesk: "support", crisp: "support",
    gong: "conv_intel", modjo: "conv_intel", chorus: "conv_intel",
    gmail: "email_calendar", outlook: "email_calendar",
    calendly: "meetings", zoom: "meetings",
    linkedin: "social_selling",
    pandadoc: "esign", yousign: "esign", docusign: "esign",
  };
  return map[key.toLowerCase()] ?? "other";
}

// ── Tool-specific report templates ──

const REPORT_TEMPLATES: Partial<Record<ToolCategory, ReportTemplate[]>> = {
  outbound: [
    { category: "outbound", displayCategory: "attribution", title: "ROI de la prospection outbound", description: "Mesurez le rendement de vos séquences outbound : combien de contacts prospectés se transforment en deals.", metrics: ["Nb de contacts créés par source outbound", "Taux de conversion contact → deal par source", "CA Closed Won issu de l'outbound (€)", "Nb de séquences actives"], expectedValue: "Mesurez le ROI réel de chaque € investi en prospection.", priority: "high", icon: "📈" },
  ],
  calling: [
    { category: "calling", displayCategory: "activite_commerciale", title: "Volume d'appels par commercial", description: "Suivez le volume d'appels, le taux de connexion et la durée par commercial.", metrics: ["Nb d'appels par jour et par owner", "Durée moyenne d'appel par owner (min)", "Taux de connexion (décrochés / tentés)", "Deals touchés par les appels"], expectedValue: "Optimisez le volume et la qualité des appels commerciaux.", priority: "high", icon: "📞" },
    { category: "calling", displayCategory: "chiffre_affaires", title: "Impact des appels sur le closing", description: "Les deals avec plus d'appels closent-ils mieux ? Mesurez la corrélation.", metrics: ["Nb moyen d'appels sur deals Won", "Nb moyen d'appels sur deals Lost", "CA Won avec appels vs sans appels (€)", "Taux de closing avec appels vs sans"], expectedValue: "Prouvez l'impact du téléphone sur le CA.", priority: "high", icon: "💪" },
  ],
  enrichment: [
    { category: "enrichment", displayCategory: "qualite_donnees", title: "ROI de l'enrichissement", description: "Les contacts enrichis convertissent-ils mieux ? Comparez enrichis vs non-enrichis.", metrics: ["% de contacts enrichis dans la base", "Taux de conversion enrichis vs non-enrichis", "CA moyen des deals issus de contacts enrichis (€)", "% de contacts enrichis par owner"], expectedValue: "Justifiez l'investissement en enrichissement par la data.", priority: "high", icon: "💎" },
  ],
  billing: [
    { category: "billing", displayCategory: "facturation_paiement", title: "Réconciliation Deals ↔ Factures", description: "Croisez vos deals gagnés avec les factures émises pour valider le CA réel.", metrics: ["CA Closed Won (HubSpot) vs Facturé (€)", "Écart HubSpot ↔ Facturation (%)", "Factures en attente de paiement", "MRR actuel (€)"], expectedValue: "Fiabilisez votre CA réel au-delà du pipeline.", priority: "high", icon: "💳" },
  ],
};

// ── Always-available CRM native reports ──

const ALWAYS_AVAILABLE_REPORTS: ReportTemplate[] = [
  // ── ATTRIBUTION ──
  {
    category: "other", displayCategory: "attribution",
    title: "Répartition des contacts par owner",
    description: "Détectez les déséquilibres de charge et les contacts non attribués.",
    metrics: ["Nb de contacts par owner", "% de la base par owner", "Contacts sans owner (non attribués)", "Évolution mensuelle de l'attribution"],
    expectedValue: "Équilibrez la charge entre commerciaux.", priority: "high", icon: "👤",
  },
  {
    category: "other", displayCategory: "attribution",
    title: "Répartition des deals par owner",
    description: "Quel commercial porte le plus de pipeline ? Mesurez la charge.",
    metrics: ["Top owners — deals actifs", "Top owners — montant pipeline (€)", "Nb de deals sans owner", "Répartition pipeline par owner (€)"],
    expectedValue: "Assurez une répartition équitable du pipeline.", priority: "high", icon: "📋",
  },

  // ── ACTIVITE COMMERCIALE ──
  {
    category: "other", displayCategory: "activite_commerciale",
    title: "Volume d'activité commerciale par owner",
    description: "Appels, emails, réunions : qui est le plus actif ? Mesurez l'effort commercial par rep.",
    metrics: ["Nb total d'appels par owner", "Nb total d'emails envoyés par owner", "Nb total de meetings par owner", "Ratio emails envoyés / reçus"],
    expectedValue: "Pilotez l'effort commercial individuel.", priority: "high", icon: "📞",
  },
  {
    category: "other", displayCategory: "activite_commerciale",
    title: "Impact des meetings sur le pipeline",
    description: "Les deals avec des meetings avancent-ils plus vite ? Mesurez la corrélation.",
    metrics: ["Deals avec meetings vs sans meetings", "CA pipeline avec meetings vs sans (€)", "Nb moyen de meetings par deal actif", "Deals won avec 3+ meetings"],
    expectedValue: "Prouvez l'impact des RDV sur le closing.", priority: "high", icon: "📅",
  },

  // ── PIPELINE ANALYSE ──
  {
    category: "other", displayCategory: "pipeline_analyse",
    title: "Répartition du pipeline par stage",
    description: "Visualisez où se trouvent vos deals dans le pipeline. Identifiez les concentrations et les vides.",
    metrics: ["Nb de deals par stage actuel", "Montant par stage actuel (€)", "Concentration du pipeline (%)", "Deals sans montant par stage"],
    expectedValue: "Identifiez les goulots et les vides dans le pipeline.", priority: "high", icon: "📊",
  },
  {
    category: "other", displayCategory: "pipeline_analyse",
    title: "Pipeline stagnant — deals bloqués",
    description: "Quels deals sont bloqués depuis trop longtemps ? Identifiez le pipeline à risque.",
    metrics: ["Nb de deals stagnants (>30j même stage)", "Montant total des deals stagnants (€)", "Top 10 deals bloqués par montant", "Stage où les deals bloquent le plus"],
    expectedValue: "Relancez les deals bloqués avant qu'ils ne soient perdus.", priority: "high", icon: "🧊",
  },
  {
    category: "other", displayCategory: "pipeline_analyse",
    title: "Santé du pipeline par pipeline",
    description: "Comparez vos pipelines : volume, montant, deals actifs et probabilité pondérée.",
    metrics: ["Deals actifs par pipeline", "Montant actif par pipeline (€)", "Pipeline pondéré par pipeline (€)", "Nb d'owners actifs par pipeline"],
    expectedValue: "Pilotez la santé de chaque pipeline.", priority: "high", icon: "🔬",
  },

  // ── CYCLE DE VENTES ──
  {
    category: "other", displayCategory: "cycle_ventes",
    title: "Vélocité du cycle de vente par pipeline",
    description: "Où vos deals passent-ils le plus de temps ? Identifiez les goulots d'étranglement.",
    metrics: ["Cycle moyen global (jours)", "Cycle moyen par pipeline", "Stage le plus bloquant", "Deals won par pipeline"],
    expectedValue: "Raccourcissez le cycle en supprimant les goulots.", priority: "high", icon: "⚡",
  },
  {
    category: "other", displayCategory: "cycle_ventes",
    title: "Forecast par pipeline pondéré",
    description: "Forecast basé sur la probabilité de chaque étape.",
    metrics: ["Pipeline pondéré total (€)", "Pipeline pondéré par owner", "CA réalisé Closed Won (€)", "Écart forecast vs réalisé (%)"],
    expectedValue: "Prévision de CA data-driven pour le COMEX.", priority: "high", icon: "🔮",
  },

  // ── CHIFFRE D'AFFAIRES ──
  {
    category: "other", displayCategory: "chiffre_affaires",
    title: "CA par pipeline",
    description: "Quel pipeline génère le plus de CA ? Comparez la performance par pipeline.",
    metrics: ["CA Closed Won par pipeline (€)", "Nb de deals Won par pipeline", "Deal moyen par pipeline (€)", "Taux de conversion par pipeline (%)"],
    expectedValue: "Identifiez quels pipelines génèrent le plus de valeur.", priority: "high", icon: "📊",
  },
  {
    category: "other", displayCategory: "chiffre_affaires",
    title: "CA par commercial (leaderboard)",
    description: "Leaderboard des commerciaux par CA signé.",
    metrics: ["CA Closed Won par owner (€)", "Nb de deals Won par owner", "Deal moyen par owner (€)", "CA réalisé Closed Won (€)"],
    expectedValue: "Identifiez les top performers.", priority: "high", icon: "🏆",
  },

  // ── QUALITE DE DONNEES ──
  {
    category: "other", displayCategory: "qualite_donnees",
    title: "Taux d'enrichissement par objet CRM",
    description: "Taux d'enrichissement réel de chaque objet pour prioriser l'effort data.",
    metrics: ["Enrichissement Contacts (%)", "Enrichissement Entreprises (%)", "Enrichissement Transactions (%)", "Score global de qualité CRM (%)"],
    expectedValue: "Priorisez l'enrichissement sur les objets qui impactent le forecast.", priority: "high", icon: "🔍",
  },
  {
    category: "other", displayCategory: "qualite_donnees",
    title: "Deals sans contact ou sans company associés",
    description: "Combien de deals n'ont ni contact ni entreprise rattachés ?",
    metrics: ["Nb de deals sans contact associé", "Nb de deals sans company associée", "Montant total des deals orphelins (€)", "% de deals orphelins par pipeline"],
    expectedValue: "Fiabilisez le reporting en corrigeant les associations manquantes.", priority: "high", icon: "⚠️",
  },
  {
    category: "other", displayCategory: "qualite_donnees",
    title: "Contacts par lifecycle stage",
    description: "Répartition de vos contacts dans le cycle de vie. Détectez les blocages de conversion.",
    metrics: ["Répartition par lifecycle stage", "% de contacts attribués par owner", "Nb de contacts orphelins (sans owner)", "Taux de conversion contact → deal par source"],
    expectedValue: "Détectez où les contacts stagnent dans le funnel.", priority: "medium", icon: "🔄",
  },

  // ── MARKETING ──
  {
    category: "other", displayCategory: "attribution",
    title: "Acquisition — volume de contacts par source",
    description: "D'où viennent vos contacts ? Mesurez le volume d'acquisition par canal pour concentrer le budget marketing.",
    metrics: ["Contacts source Offline", "Contacts source Organic Search", "Contacts source Direct Traffic", "Contacts source Autres"],
    expectedValue: "Identifiez vos canaux d'acquisition les plus performants.", priority: "high", icon: "📣",
  },
  {
    category: "other", displayCategory: "attribution",
    title: "Vélocité d'acquisition — contacts créés par mois",
    description: "Combien de nouveaux contacts entrent dans le CRM chaque mois ? Suivez la tendance d'acquisition.",
    metrics: ["Contacts créés par mois (tendance)", "Contacts créés ce mois", "Contacts créés mois précédent", "Variation mois vs mois (%)"],
    expectedValue: "Suivez la dynamique d'acquisition mois par mois.", priority: "high", icon: "📈",
  },
  {
    category: "other", displayCategory: "attribution",
    title: "Funnel Lead → Opportunity → Deal",
    description: "Analysez votre funnel de conversion : combien de leads deviennent des opportunités puis des deals ?",
    metrics: ["Total contacts Lead", "Total contacts Opportunity", "Taux Lead → Opportunity (%)", "Deals créés par mois (tendance)"],
    expectedValue: "Optimisez chaque étape du funnel de conversion.", priority: "high", icon: "🔻",
  },
  {
    category: "other", displayCategory: "qualite_donnees",
    title: "Base marketing — santé et exploitabilité",
    description: "Votre base est-elle exploitable pour le marketing ? Email valide, téléphone, poste, entreprise rattachée.",
    metrics: ["Contacts avec email (%)", "Contacts avec téléphone (%)", "Contacts avec poste (%)", "Contacts rattachés à une entreprise (%)"],
    expectedValue: "Assurez-vous que votre base est exploitable pour vos campagnes.", priority: "high", icon: "🎯",
  },

  // ── FINANCE / REVOPS ──
  {
    category: "other", displayCategory: "chiffre_affaires",
    title: "Pipeline par montant — capacité de projection",
    description: "Quel est le montant total du pipeline ouvert ? Combien de deals ont un montant renseigné ?",
    metrics: ["Pipeline total ouvert (€)", "Deals avec montant (%)", "Deal moyen ouvert (€)", "Pipeline pondéré total (€)"],
    expectedValue: "Mesurez votre capacité de projection revenue.", priority: "high", icon: "💰",
  },
  {
    category: "other", displayCategory: "chiffre_affaires",
    title: "Revenue par pipeline — contribution au CA",
    description: "Comparez la contribution de chaque pipeline au CA global. Identifiez les pipelines les plus rentables.",
    metrics: ["CA total par pipeline (€)", "Deals actifs par pipeline", "Deal moyen par pipeline actif (€)", "Pipeline pondéré par pipeline (€)"],
    expectedValue: "Identifiez les pipelines qui contribuent le plus au CA.", priority: "high", icon: "📊",
  },
  {
    category: "other", displayCategory: "chiffre_affaires",
    title: "Deals créés vs closés — ratio d'efficacité",
    description: "Combien de deals sont créés vs fermés chaque mois ? Le pipeline grossit-il ou se consume-t-il ?",
    metrics: ["Deals créés par mois (tendance)", "Deals won par mois (tendance)", "Ratio créés / closés", "Pipeline net (créés - closés)"],
    expectedValue: "Un pipeline sain crée plus qu'il ne consomme.", priority: "high", icon: "⚖️",
  },
];

// ── Main export ──

export function getReportSuggestions(
  integrations: DetectedIntegration[],
  fieldCompleteness?: {
    contactsWithOwner?: number;
    contactsWithPhone?: number;
    contactsWithCompany?: number;
    dealsWithAmount?: number;
    dealsWithCloseDate?: number;
  },
): ReportSuggestion[] {
  const byCategory = new Map<ToolCategory, DetectedIntegration[]>();
  for (const int of integrations) {
    const cat = getToolCategory(int.key);
    if (cat === "other") continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(int);
  }

  const enrichmentByCategory = new Map<ToolCategory, number>();
  for (const [cat, ints] of byCategory.entries()) {
    const avg = ints.length > 0
      ? Math.round(ints.reduce((s, i) => s + i.enrichmentRate, 0) / ints.length)
      : 0;
    enrichmentByCategory.set(cat, avg);
  }

  const suggestions: ReportSuggestion[] = [];
  for (const [cat, ints] of byCategory.entries()) {
    const templates = REPORT_TEMPLATES[cat] || [];
    const sources = ints.map((i) => ({ key: i.key, label: i.label, icon: i.icon }));
    const enrichment = enrichmentByCategory.get(cat) ?? 0;
    templates.forEach((tpl, idx) => {
      suggestions.push({ ...tpl, id: `${cat}_${idx}`, sourceIntegrations: sources, reliabilityPct: enrichment });
    });
  }

  const fc = fieldCompleteness ?? {};
  const crmReliability: Partial<Record<DisplayCategory, number>> = {
    attribution: fc.contactsWithOwner ?? 70,
    chiffre_affaires: fc.dealsWithAmount ?? 70,
    qualite_donnees: Math.round(
      ((fc.contactsWithPhone ?? 70) + (fc.contactsWithCompany ?? 70) + (fc.contactsWithOwner ?? 70)) / 3,
    ),
    cycle_ventes: fc.dealsWithCloseDate ?? 70,
    activite_commerciale: 85,
    pipeline_analyse: 80,
  };

  for (const tpl of ALWAYS_AVAILABLE_REPORTS) {
    suggestions.push({
      ...tpl,
      id: `always_${tpl.displayCategory}_${tpl.title.slice(0, 30).replace(/\W/g, "_")}`,
      sourceIntegrations: [],
      reliabilityPct: crmReliability[tpl.displayCategory] ?? 70,
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
}
