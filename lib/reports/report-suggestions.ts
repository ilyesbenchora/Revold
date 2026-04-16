/**
 * Report Suggestion Engine — single-source reports.
 *
 * Each report is generated from ONE tool category detected on the portal.
 * Reports are tagged with a displayCategory for the user-facing filter
 * across the 7 RevOps categories: Attribution, Chiffre d'affaires,
 * Facturation & Paiement, Service client, Qualite de donnees,
 * Adoption outils, Cycle de ventes.
 *
 * All KPIs reference real HubSpot CRM API endpoints + canonical Supabase tables.
 */

import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";

// ---------------------------------------------------------------------------
// Internal tool category (which tool drives the report)
// ---------------------------------------------------------------------------
export type ToolCategory =
  | "outbound"
  | "calling"
  | "enrichment"
  | "esign"
  | "billing"
  | "support"
  | "conv_intel"
  | "email_calendar"
  | "meetings"
  | "social_selling"
  | "other";

// ---------------------------------------------------------------------------
// User-facing display category for the filter pills (7 categories)
// ---------------------------------------------------------------------------
export type DisplayCategory =
  | "attribution"
  | "chiffre_affaires"
  | "facturation_paiement"
  | "service_client"
  | "qualite_donnees"
  | "adoption_outils"
  | "cycle_ventes";

// ---------------------------------------------------------------------------
// Tool category mapping
// ---------------------------------------------------------------------------
const TOOL_CATEGORY: Record<string, ToolCategory> = {
  lemlist: "outbound",
  apollo: "outbound",
  salesloft: "outbound",
  lagrowthmachine: "outbound",
  aircall: "calling",
  ringover: "calling",
  justcall: "calling",
  kaspr: "enrichment",
  dropcontact: "enrichment",
  lusha: "enrichment",
  zoominfo: "enrichment",
  pandadoc: "esign",
  yousign: "esign",
  docusign: "esign",
  stripe: "billing",
  pennylane: "billing",
  sellsy: "billing",
  axonaut: "billing",
  quickbooks: "billing",
  intercom: "support",
  zendesk: "support",
  crisp: "support",
  freshdesk: "support",
  modjo: "conv_intel",
  gong: "conv_intel",
  chorus: "conv_intel",
  outlook: "email_calendar",
  gmail: "email_calendar",
  calendly: "email_calendar",
  zoom: "meetings",
  linkedin: "social_selling",
  linkedin_sales_nav: "social_selling",
  mailchimp: "email_calendar",
  brevo: "email_calendar",
  activecampaign: "email_calendar",
  zapier: "other",
  make: "other",
  n8n: "other",
};

// ---------------------------------------------------------------------------
// Report suggestion type
// ---------------------------------------------------------------------------
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
  /** Reliability % based on the enrichment rate of the source tools (0-100).
   *  Computed dynamically from the actual CRM data, not hardcoded. */
  reliabilityPct: number;
};

type ReportTemplate = Omit<ReportSuggestion, "id" | "sourceIntegrations" | "reliabilityPct">;

// ---------------------------------------------------------------------------
// REPORT TEMPLATES — tool-specific reports (20+ across 7 categories)
// ---------------------------------------------------------------------------
const REPORT_TEMPLATES: Record<ToolCategory, ReportTemplate[]> = {
  // ===== OUTBOUND =====
  outbound: [
    {
      category: "outbound",
      displayCategory: "attribution",
      title: "Attribution des contacts par source outbound",
      description:
        "Quels commerciaux génèrent le plus de contacts qualifiés via vos campagnes outbound ? Ce rapport révèle la performance de chaque SDR.",
      metrics: [
        "Nb de contacts créés par source outbound",
        "% de contacts attribués par owner",
        "Taux de conversion contact → deal par source",
        "Nb de contacts orphelins (sans owner)",
      ],
      expectedValue:
        "Identifiez quels SDR génèrent le plus de contacts qualifiés via outbound.",
      priority: "high",
      icon: "🎯",
    },
    {
      category: "outbound",
      displayCategory: "chiffre_affaires",
      title: "CA généré par campagne outbound",
      description:
        "Combien de revenus vos campagnes outbound génèrent-elles réellement ? Mesurez le CA signé par canal d'acquisition.",
      metrics: [
        "CA total Closed Won issu de l'outbound (€)",
        "Nb de deals Closed Won par campagne",
        "Deal moyen Closed Won (€)",
        "Comparaison outbound vs inbound",
      ],
      expectedValue:
        "Mesurez le ROI réel de chaque séquence outbound en euros.",
      priority: "high",
      icon: "💰",
    },
    {
      category: "outbound",
      displayCategory: "cycle_ventes",
      title: "Cycle de vente des leads outbound",
      description:
        "L'outbound raccourcit-il ou allonge-t-il votre cycle de vente ? Comparez les délais par canal d'acquisition.",
      metrics: [
        "Durée moyenne first-touch → Closed Won (jours)",
        "Durée médiane par pipeline",
        "Temps par étape (hs_time_in_latest_deal_stage)",
        "Comparaison outbound vs inbound",
      ],
      expectedValue:
        "Comprenez si l'outbound raccourcit ou allonge le cycle de vente.",
      priority: "medium",
      icon: "⏱️",
    },
  ],

  // ===== CALLING =====
  calling: [
    {
      category: "calling",
      displayCategory: "cycle_ventes",
      title: "Impact des appels sur la progression des deals",
      description:
        "Combien d'appels faut-il pour closer un deal ? Identifiez le nombre optimal de touches téléphoniques.",
      metrics: [
        "Nb moyen d'appels par deal gagné vs perdu",
        "Durée moyenne des appels sur deals won",
        "% des deals won ayant eu un appel",
        "CA total des deals avec appels (€)",
      ],
      expectedValue:
        "Identifiez le nombre optimal d'appels pour closer un deal.",
      priority: "high",
      icon: "📞",
    },
    {
      category: "calling",
      displayCategory: "attribution",
      title: "Volume d'appels par commercial",
      description:
        "Classement de vos commerciaux par activité téléphonique : volume, durée et taux de décroché.",
      metrics: [
        "Nb d'appels par owner / jour",
        "Durée totale d'appels par owner (h)",
        "Taux de connexion (décrochés / tentés)",
        "Nb de deals touchés par les appels par owner",
      ],
      expectedValue:
        "Coaching ciblé sur l'activité téléphonique de chaque commercial.",
      priority: "medium",
      icon: "🏆",
    },
    {
      category: "calling",
      displayCategory: "chiffre_affaires",
      title: "CA influencé par les appels téléphoniques",
      description:
        "Quel CA est directement influencé par les appels téléphoniques ? Quantifiez l'impact business du canal téléphonique.",
      metrics: [
        "CA total des deals avec appels (€)",
        "CA moyen par deal avec appels vs sans appels",
        "% des deals won ayant eu un appel",
        "Top 5 commerciaux par CA influencé via appels",
      ],
      expectedValue:
        "Quantifiez la valeur business du canal téléphonique.",
      priority: "high",
      icon: "💵",
    },
  ],

  // ===== ENRICHMENT =====
  enrichment: [
    {
      category: "enrichment",
      displayCategory: "qualite_donnees",
      title: "ROI de l'enrichissement de données",
      description:
        "Quel est le taux de complétude de votre base contacts ? Identifiez les champs à enrichir en priorité.",
      metrics: [
        "% de contacts enrichis dans la base",
        "% de contacts enrichis par owner",
        "Complétude par champ clé (%)",
        "Nb de contacts à enrichir en priorité par owner",
      ],
      expectedValue:
        "Justifiez ou optimisez l'investissement en enrichissement.",
      priority: "high",
      icon: "💎",
    },
    {
      category: "enrichment",
      displayCategory: "qualite_donnees",
      title: "Contacts orphelins sans entreprise",
      description:
        "Combien de contacts n'ont aucune entreprise rattachée ? Ces orphelins faussent votre segmentation et votre scoring ABM.",
      metrics: [
        "Nb de contacts sans company associée",
        "% de contacts orphelins",
        "Nb de contacts orphelins (sans owner)",
        "Lifecycle stage des contacts orphelins",
      ],
      expectedValue:
        "Rattachez les contacts orphelins pour une segmentation ABM efficace.",
      priority: "medium",
      icon: "🔗",
    },
    {
      category: "enrichment",
      displayCategory: "attribution",
      title: "Couverture d'enrichissement par owner",
      description:
        "Quel commercial a le portefeuille le mieux renseigné ? Ciblez l'enrichissement là où il aura le plus d'impact.",
      metrics: [
        "% de contacts enrichis par owner",
        "Champs manquants les plus fréquents par owner",
        "Score de qualité moyen par portefeuille",
        "Nb de contacts à enrichir en priorité par owner",
      ],
      expectedValue:
        "Ciblez l'enrichissement sur les portefeuilles les moins complets.",
      priority: "low",
      icon: "📊",
    },
  ],

  // E-SIGN: requires PandaDoc/Yousign/DocuSign integration — no reports without it
  esign: [],

  // ===== BILLING =====
  billing: [
    {
      category: "billing",
      displayCategory: "facturation_paiement",
      title: "Réconciliation Deals gagnés vs Factures émises",
      description:
        "Vos deals signés sont-ils tous facturés ? Identifiez les écarts entre le pipeline CRM et la facturation réelle.",
      metrics: [
        "CA forecast HubSpot vs facturé réel (€)",
        "Écart moyen forecast vs facturé (%)",
        "Montant total facturé (€)",
        "Montant total encaissé (€)",
      ],
      expectedValue:
        "Fiabilisez le forecast et récupérez le CA signé non facturé.",
      priority: "high",
      icon: "💳",
    },
    {
      category: "billing",
      displayCategory: "facturation_paiement",
      title: "MRR & ARR — suivi du revenu récurrent",
      description:
        "Suivez votre revenu récurrent mensuel et annuel. Pilotez la croissance avec des métriques SaaS fiables.",
      metrics: [
        "MRR total actuel (€)",
        "ARR extrapolé (€)",
        "Taux de churn gross (%)",
        "Nb de paiements réussis vs échoués",
      ],
      expectedValue:
        "Pilotez la croissance du revenu récurrent avec des chiffres fiables.",
      priority: "high",
      icon: "📈",
    },
    {
      category: "billing",
      displayCategory: "facturation_paiement",
      title: "Taux de succès des paiements",
      description:
        "Quel pourcentage de vos paiements échouent ? Réduisez le churn involontaire en surveillant les échecs.",
      metrics: [
        "Nb de paiements réussis vs échoués",
        "Taux de succès global (%)",
        "Montant total en échec (€)",
        "Montant total impayé (€)",
      ],
      expectedValue:
        "Réduisez les échecs de paiement et le churn involontaire.",
      priority: "high",
      icon: "💰",
    },
    {
      category: "billing",
      displayCategory: "facturation_paiement",
      title: "Factures impayées et encours client",
      description:
        "Combien de factures restent impayées et depuis combien de temps ? Priorisez le recouvrement.",
      metrics: [
        "Montant total impayé (€)",
        "Nb de factures en attente de paiement",
        "Nb de factures impayées > 90 jours",
        "Montant total facturé (€)",
      ],
      expectedValue:
        "Priorisez le recouvrement et améliorez le DSO.",
      priority: "high",
      icon: "🧾",
    },
    {
      category: "billing",
      displayCategory: "chiffre_affaires",
      title: "Churn et contraction du MRR",
      description:
        "Quel est votre taux de churn et combien de revenus perdez-vous chaque mois ? Agissez avant l'hémorragie.",
      metrics: [
        "Taux de churn gross (%)",
        "MRR total actuel (€)",
        "ARR extrapolé (€)",
        "Nb de paiements réussis vs échoués",
      ],
      expectedValue:
        "Identifiez les cohortes à risque et agissez avant le churn massif.",
      priority: "high",
      icon: "📉",
    },
  ],

  // ===== SUPPORT =====
  support: [
    {
      category: "support",
      displayCategory: "service_client",
      title: "Volume et résolution des tickets support",
      description:
        "Combien de tickets ouverts vs fermés ? Surveillez la charge support et le taux de résolution.",
      metrics: [
        "Nb de tickets ouverts / fermés par période",
        "% de tickets haute priorité",
        "Taux de résolution au 1er contact (%)",
        "Taux de réouverture de tickets (%)",
      ],
      expectedValue:
        "Améliorez la satisfaction client en réduisant les temps de réponse.",
      priority: "high",
      icon: "🎧",
    },
    {
      category: "support",
      displayCategory: "service_client",
      title: "Tickets par canal et par priorité",
      description:
        "Par quel canal arrivent vos tickets et combien sont critiques ? Allouez vos agents efficacement.",
      metrics: [
        "Nb de tickets par canal",
        "% de tickets haute priorité",
        "Tickets par pipeline support",
        "Tickets haute priorité ouverts",
      ],
      expectedValue:
        "Optimisez l'allocation des agents support par canal.",
      priority: "medium",
      icon: "📊",
    },
    {
      category: "support",
      displayCategory: "service_client",
      title: "CSAT proxy — satisfaction client estimée",
      description:
        "Estimez la satisfaction client à partir de vos données support : résolution, réouvertures et performance par agent.",
      metrics: [
        "Score CSAT proxy global (%)",
        "CSAT proxy par agent support",
        "Taux de réouverture de tickets (%)",
        "Nb de tickets ouverts / fermés par mois",
      ],
      expectedValue:
        "Suivez la satisfaction client sans sondage explicite.",
      priority: "medium",
      icon: "⭐",
    },
  ],

  // ===== CONVERSATIONAL INTELLIGENCE =====
  conv_intel: [
    {
      category: "conv_intel",
      displayCategory: "cycle_ventes",
      title: "Patterns conversationnels gagnants vs perdants",
      description:
        "Qu'est-ce qui différencie un deal gagné d'un deal perdu ? Analysez les patterns de communication gagnants.",
      metrics: [
        "Nb moyen de calls/meetings sur deals Won vs Lost",
        "Durée moyenne des calls sur deals Won",
        "Ratio emails envoyés / réponses reçues (hs_sales_email_last_replied)",
        "Nb de notes logées (num_notes) sur deals gagnés",
      ],
      expectedValue:
        "Formalisez la méthode de vente qui close.",
      priority: "medium",
      icon: "🎙️",
    },
    {
      category: "conv_intel",
      displayCategory: "chiffre_affaires",
      title: "Impact des meetings sur le Closed Won",
      description:
        "Combien de meetings faut-il pour signer ? Identifiez le seuil optimal pour maximiser le CA.",
      metrics: [
        "Nb moyen de meetings par deal Won vs Lost",
        "CA moyen des deals avec 3+ meetings (€)",
        "Taux de conversion avec meeting vs sans",
        "Top commerciaux par CA influencé via meetings",
      ],
      expectedValue:
        "Identifiez le bon nombre de meetings pour maximiser le CA.",
      priority: "high",
      icon: "📅",
    },
  ],

  // ===== EMAIL & CALENDAR =====
  email_calendar: [
    {
      category: "email_calendar",
      displayCategory: "cycle_ventes",
      title: "Activité email et impact sur la vélocité du pipeline",
      description:
        "Vos emails accélèrent-ils le cycle de vente ? Analysez la cadence optimale et le taux de réponse.",
      metrics: [
        "Nb moyen d'emails par deal",
        "Taux de réponse email par deal (hs_sales_email_last_replied)",
        "Nb de touchpoints email avant Closed Won",
        "Taux de réponse par owner (%)",
      ],
      expectedValue:
        "Optimisez la cadence email pour accélérer le cycle.",
      priority: "medium",
      icon: "📨",
    },
    {
      category: "email_calendar",
      displayCategory: "attribution",
      title: "Activité email par commercial",
      description:
        "Classement de vos commerciaux par volume d'emails et taux de réponse obtenu.",
      metrics: [
        "Nb d'emails envoyés par owner / semaine",
        "Nb d'emails reçus (réponses) par owner",
        "Taux de réponse par owner (%)",
        "Top 5 commerciaux les plus actifs par email",
      ],
      expectedValue:
        "Identifiez les commerciaux les plus engagés par email.",
      priority: "low",
      icon: "📧",
    },
  ],

  // ===== MEETINGS =====
  meetings: [
    {
      category: "meetings",
      displayCategory: "cycle_ventes",
      title: "Conversion meetings → Opportunités",
      description:
        "Vos meetings se transforment-ils en opportunités ? Mesurez le taux de conversion meeting → deal.",
      metrics: [
        "Nb de meetings tenus par période",
        "Taux de conversion meeting → deal créé",
        "Taux de show-up (meetings réalisés / planifiés)",
        "Nb moyen de meetings par deal fermé",
      ],
      expectedValue:
        "Optimisez le ratio meetings / résultats pipeline.",
      priority: "medium",
      icon: "📅",
    },
  ],

  // ===== SOCIAL SELLING =====
  social_selling: [
    {
      category: "social_selling",
      displayCategory: "attribution",
      title: "Contacts créés via Social Selling",
      description:
        "Combien de contacts proviennent de LinkedIn et des réseaux sociaux ? Mesurez l'apport réel du social selling.",
      metrics: [
        "Nb de contacts source SOCIAL",
        "% des contacts totaux issus du social",
        "Taux de conversion social → deal",
        "CA généré via contacts social (€)",
      ],
      expectedValue:
        "Mesurez l'apport réel de LinkedIn dans le pipeline.",
      priority: "medium",
      icon: "💼",
    },
    {
      category: "social_selling",
      displayCategory: "chiffre_affaires",
      title: "CA issu du canal Social Selling",
      description:
        "Quel CA est généré par le canal social selling ? Justifiez votre investissement LinkedIn avec des données.",
      metrics: [
        "CA total Closed Won source SOCIAL (€)",
        "Nb de deals Won source SOCIAL",
        "Taille moyenne des deals SOCIAL vs autres sources",
        "Cycle moyen des deals SOCIAL (jours)",
      ],
      expectedValue:
        "Justifiez l'investissement Sales Navigator avec des chiffres.",
      priority: "medium",
      icon: "📊",
    },
  ],

  // ===== OTHER =====
  other: [],
};

// ---------------------------------------------------------------------------
// ALWAYS-AVAILABLE REPORTS — CRM-native, no specific tool needed
// These reports use only HubSpot CRM API data + Supabase canonical tables
// ---------------------------------------------------------------------------
const ALWAYS_AVAILABLE_REPORTS: ReportTemplate[] = [
  // --- ATTRIBUTION ---
  {
    category: "other",
    displayCategory: "attribution",
    title: "Répartition des contacts par owner",
    description:
      "Comment vos contacts sont-ils répartis entre commerciaux ? Détectez les déséquilibres et les contacts non attribués.",
    metrics: [
      "Nb de contacts par owner",
      "% de la base par owner",
      "Contacts sans owner (non attribués)",
      "Évolution mensuelle de l'attribution",
    ],
    expectedValue:
      "Équilibrez la charge entre commerciaux et détectez les contacts non attribués.",
    priority: "high",
    icon: "👤",
  },
  {
    category: "other",
    displayCategory: "attribution",
    title: "Répartition des deals par owner",
    description:
      "Quel commercial porte le plus de pipeline ? Assurez une répartition équitable des opportunités.",
    metrics: [
      "Top owners — deals actifs",
      "Top owners — montant pipeline (€)",
      "Nb de deals sans owner",
      "Répartition pipeline par owner (€)",
    ],
    expectedValue:
      "Assurez une répartition équitable du pipeline entre commerciaux.",
    priority: "high",
    icon: "📋",
  },
  {
    category: "other",
    displayCategory: "attribution",
    title: "Répartition des entreprises par owner",
    description:
      "Comment vos comptes sont-ils répartis entre commerciaux ? Identifiez les portefeuilles stratégiques.",
    metrics: [
      "Nb de companies par owner",
      "Revenue annuel total des companies par owner (€)",
      "Companies sans owner",
      "Répartition par industrie par owner",
    ],
    expectedValue:
      "Pilotez l'attribution des comptes stratégiques.",
    priority: "medium",
    icon: "🏢",
  },

  // --- CHIFFRE D'AFFAIRES ---
  {
    category: "other",
    displayCategory: "chiffre_affaires",
    title: "Deals Closed Won — volume et montant par période",
    description:
      "Combien de deals sont closés chaque mois et pour quel montant ? Suivez la trajectoire du CA.",
    metrics: [
      "Nb de deals Closed Won par mois",
      "CA total Closed Won par mois (€)",
      "Deal moyen Closed Won (€)",
      "Évolution vs mois précédent (%)",
    ],
    expectedValue:
      "Suivez la trajectoire du CA et détectez les tendances.",
    priority: "high",
    icon: "💰",
  },
  {
    category: "other",
    displayCategory: "chiffre_affaires",
    title: "CA par pipeline",
    description:
      "Quel pipeline génère le plus de CA ? Comparez la performance et le deal moyen de chaque pipeline.",
    metrics: [
      "CA Closed Won par pipeline (€)",
      "Nb de deals Won par pipeline",
      "Deal moyen par pipeline (€)",
      "Taux de conversion par pipeline (%)",
    ],
    expectedValue:
      "Identifiez quels pipelines génèrent le plus de valeur.",
    priority: "high",
    icon: "📊",
  },
  {
    category: "other",
    displayCategory: "chiffre_affaires",
    title: "CA par commercial (leaderboard)",
    description:
      "Leaderboard des commerciaux par CA signé. Identifiez les top performers et ceux à coacher.",
    metrics: [
      "CA Closed Won par owner (€)",
      "Nb de deals Won par owner",
      "Deal moyen par owner (€)",
      "CA réalisé Closed Won (€)",
    ],
    expectedValue:
      "Identifiez les top performers et ceux qui ont besoin de coaching.",
    priority: "high",
    icon: "🏆",
  },
  {
    category: "other",
    displayCategory: "chiffre_affaires",
    title: "Forecast vs Réalisé — précision du pipeline",
    description:
      "Vos prévisions de CA sont-elles fiables ? Comparez le forecast pondéré au CA réellement signé.",
    metrics: [
      "Pipeline weighted total (€)",
      "CA réalisé Closed Won (€)",
      "Écart forecast vs réalisé (%)",
      "Pipeline weighted par owner",
    ],
    expectedValue:
      "Améliorez la fiabilité de vos prévisions de CA.",
    priority: "high",
    icon: "🎯",
  },

  // --- FACTURATION & PAIEMENT ---
  {
    category: "other",
    displayCategory: "facturation_paiement",
    title: "Vue d'ensemble facturation mensuelle",
    description:
      "Vue consolidée de votre facturation : émises, encaissées et en attente de paiement.",
    metrics: [
      "Nb de factures émises par mois",
      "Montant total facturé (€)",
      "Montant total encaissé (€)",
      "Nb de factures en attente de paiement",
    ],
    expectedValue:
      "Vue consolidée de la santé de la facturation.",
    priority: "medium",
    icon: "🧾",
  },

  // --- SERVICE CLIENT ---
  {
    category: "other",
    displayCategory: "service_client",
    title: "Volume de tickets CRM natifs",
    description:
      "Volume et statut de vos tickets support. Surveillez la charge et les priorités.",
    metrics: [
      "Nb de tickets ouverts / fermés par mois",
      "% de tickets haute priorité",
      "Tickets par pipeline support",
      "Tickets haute priorité ouverts",
    ],
    expectedValue:
      "Suivez l'activité support directement depuis le CRM.",
    priority: "medium",
    icon: "🎫",
  },

  // --- QUALITE DE DONNEES ---
  {
    category: "other",
    displayCategory: "qualite_donnees",
    title: "Taux d'enrichissement par objet CRM",
    description:
      "Quel est le taux d'enrichissement réel de chaque objet ? Identifiez les objets sous-renseignés pour prioriser l'effort data.",
    metrics: [
      "Enrichissement Contacts (%)",
      "Enrichissement Entreprises (%)",
      "Enrichissement Transactions (%)",
      "Score global de qualité CRM (%)",
    ],
    expectedValue:
      "Priorisez l'enrichissement sur les objets qui impactent le plus le forecast et le pipeline.",
    priority: "high",
    icon: "🔍",
  },
  {
    category: "other",
    displayCategory: "qualite_donnees",
    title: "Deals sans contact ou sans company associés",
    description:
      "Combien de deals n'ont ni contact ni entreprise rattachés ? Ces orphelins faussent votre reporting.",
    metrics: [
      "Nb de deals sans contact associé",
      "Nb de deals sans company associée",
      "Montant total des deals orphelins (€)",
      "% de deals orphelins par pipeline",
    ],
    expectedValue:
      "Fiabilisez le reporting en corrigeant les associations manquantes.",
    priority: "high",
    icon: "⚠️",
  },

  // ADOPTION OUTILS: requires usage tracking — no reports without it

  // --- CYCLE DE VENTES ---
  {
    category: "other",
    displayCategory: "cycle_ventes",
    title: "Vélocité du cycle de vente par pipeline",
    description:
      "Où vos deals passent-ils le plus de temps ? Identifiez les goulots d'étranglement dans votre pipeline.",
    metrics: [
      "Cycle moyen global (jours)",
      "Cycle moyen par pipeline",
      "Stage le plus bloquant",
      "Deals won par pipeline",
    ],
    expectedValue:
      "Raccourcissez le cycle en supprimant les goulots d'étranglement.",
    priority: "high",
    icon: "⚡",
  },
  {
    category: "other",
    displayCategory: "cycle_ventes",
    title: "Taux de conversion par stage",
    description:
      "À quelle étape perdez-vous le plus de deals ? Analysez le taux de conversion entre chaque stage.",
    metrics: [
      "Taux de conversion entre chaque stage (%)",
      "Stage avec le plus de déperdition",
      "Taux de conversion global pipeline → Won",
      "Évolution mensuelle des taux de conversion",
    ],
    expectedValue:
      "Identifiez où les deals se perdent dans le funnel.",
    priority: "high",
    icon: "🔻",
  },
  {
    category: "other",
    displayCategory: "cycle_ventes",
    title: "Pipeline stagnant — deals bloqués",
    description:
      "Quels deals sont bloqués depuis trop longtemps ? Identifiez le pipeline à risque avant qu'il soit perdu.",
    metrics: [
      "Nb de deals stagnants (>30j même stage)",
      "Montant total des deals stagnants (€)",
      "Top 10 deals bloqués par montant",
      "Stage où les deals bloquent le plus",
    ],
    expectedValue:
      "Relancez les deals bloqués avant qu'ils ne soient perdus.",
    priority: "high",
    icon: "🧊",
  },
  {
    category: "other",
    displayCategory: "cycle_ventes",
    title: "Forecast par weighted pipeline",
    description:
      "Forecast data-driven basé sur la probabilité de chaque étape. Prévision de CA pour le comité de direction.",
    metrics: [
      "Pipeline weighted total (€)",
      "Pipeline weighted par owner",
      "CA réalisé Closed Won (€)",
      "Écart forecast vs réalisé (%)",
    ],
    expectedValue:
      "Prévision de CA data-driven pour le comité de direction.",
    priority: "high",
    icon: "🔮",
  },
];

// ---------------------------------------------------------------------------
// Display category labels (French)
// ---------------------------------------------------------------------------
const DISPLAY_CATEGORY_LABELS: Record<DisplayCategory, string> = {
  attribution: "Attribution",
  chiffre_affaires: "Chiffre d'affaires",
  facturation_paiement: "Facturation & Paiement",
  service_client: "Service client",
  qualite_donnees: "Qualit\u00e9 de donn\u00e9es",
  adoption_outils: "Adoption outils",
  cycle_ventes: "Cycle de ventes",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getDisplayCategoryLabel(cat: DisplayCategory): string {
  return DISPLAY_CATEGORY_LABELS[cat] ?? cat;
}

export function getToolCategory(integrationKey: string): ToolCategory {
  return TOOL_CATEGORY[integrationKey] || "other";
}

export function getCategoryLabel(cat: ToolCategory): string {
  return DISPLAY_CATEGORY_LABELS[cat as unknown as DisplayCategory] ?? cat;
}

/**
 * Build report suggestions with a dynamic reliability % based on the
 * enrichment rate of the source tools detected on the CRM.
 *
 * @param fieldCompleteness — optional object with contact/deal field coverage
 *   (e.g. { contactsWithOwner: 80, dealsWithAmount: 92 }) for CRM-native reports.
 *   Values are percentages 0-100. If omitted, defaults to 70%.
 */
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

  // Average enrichment rate per tool category (for reliability computation)
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
    const sources = ints.map((i) => ({
      key: i.key,
      label: i.label,
      icon: i.icon,
    }));
    const enrichment = enrichmentByCategory.get(cat) ?? 0;

    templates.forEach((tpl, idx) => {
      suggestions.push({
        ...tpl,
        id: `${cat}_${idx}`,
        sourceIntegrations: sources,
        reliabilityPct: enrichment,
      });
    });
  }

  // Always-available reports — reliability from field completeness
  const fc = fieldCompleteness ?? {};
  const crmReliability: Record<DisplayCategory, number> = {
    attribution: fc.contactsWithOwner ?? 70,
    chiffre_affaires: fc.dealsWithAmount ?? 70,
    facturation_paiement: 70,
    service_client: 70,
    qualite_donnees: Math.round(
      ((fc.contactsWithPhone ?? 70) + (fc.contactsWithCompany ?? 70) + (fc.contactsWithOwner ?? 70)) / 3,
    ),
    adoption_outils: 70,
    cycle_ventes: fc.dealsWithCloseDate ?? 70,
  };

  for (const tpl of ALWAYS_AVAILABLE_REPORTS) {
    suggestions.push({
      ...tpl,
      id: `always_${tpl.displayCategory}_${tpl.title
        .slice(0, 30)
        .replace(/\W/g, "_")}`,
      sourceIntegrations: [],
      reliabilityPct: crmReliability[tpl.displayCategory] ?? 70,
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
}

export { DISPLAY_CATEGORY_LABELS };
export type { DisplayCategory as ReportDisplayCategory };
