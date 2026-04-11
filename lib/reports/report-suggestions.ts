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
        "Répartition des contacts créés via les campagnes outbound par owner HubSpot. Croisement hs_analytics_source = OFFLINE / DIRECT_TRAFFIC avec les séquences outbound.",
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
        "Revenue des deals Closed Won (amount) dont le contact source provient d'une séquence outbound. Croisement deal → contact → source.",
      metrics: [
        "CA total Closed Won issu de l'outbound (€)",
        "CA moyen par séquence",
        "Nb de deals Closed Won par campagne",
        "ROI par campagne (CA / coût outil)",
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
        "Temps moyen entre le premier contact outbound et le Closed Won. Utilise closedate et createdate des deals associés.",
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
        "Corrélation entre le nb d'appels logués (/crm/v3/objects/calls) par deal et la vélocité de progression dans le pipeline.",
      metrics: [
        "Nb moyen d'appels par deal gagné vs perdu",
        "Durée moyenne des appels sur deals won",
        "Conversion call → avancement de stage",
        "Délai moyen entre appel et changement de stage",
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
        "Classement des commerciaux par nombre d'appels passés, durée totale et taux de connexion. Données /crm/v3/objects/calls groupées par hubspot_owner_id.",
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
        "Revenue des deals Closed Won ayant eu au moins un appel logué dans les 30 jours précédant le closing.",
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
        "Compare la conversion et le CA des contacts enrichis vs non-enrichis. Identifie les champs enrichis (email, téléphone, titre) qui impactent le plus le taux de conversion.",
      metrics: [
        "% de contacts enrichis dans la base",
        "Taux de conversion enrichi vs non-enrichi",
        "CA moyen sur deals avec contacts enrichis (€)",
        "Champs les plus impactants sur la conversion",
      ],
      expectedValue:
        "Justifiez ou optimisez l'investissement en enrichissement.",
      priority: "high",
      icon: "💎",
    },
    {
      category: "enrichment",
      displayCategory: "qualite_donnees",
      title: "Taux de doublons dans la base contacts",
      description:
        "Détection des contacts en doublon par email, nom+prénom ou téléphone. Croisement /crm/v3/objects/contacts avec déduplication.",
      metrics: [
        "Nb total de doublons détectés",
        "% de doublons dans la base",
        "Top 10 doublons par volume",
        "Doublons avec des deals actifs associés",
      ],
      expectedValue:
        "Nettoyez la base CRM pour fiabiliser les métriques et le routing.",
      priority: "medium",
      icon: "🧹",
    },
    {
      category: "enrichment",
      displayCategory: "qualite_donnees",
      title: "Contacts orphelins sans entreprise",
      description:
        "Contacts HubSpot sans association company (/crm/v3/objects/contacts → associations). Impact sur le scoring et la segmentation.",
      metrics: [
        "Nb de contacts sans company associée",
        "% de contacts orphelins",
        "Contacts orphelins avec deals actifs",
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
        "Pour chaque commercial, quel % de ses contacts sont enrichis (email pro, téléphone direct, titre de poste remplis).",
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

  // ===== E-SIGN =====
  esign: [
    {
      category: "esign",
      displayCategory: "cycle_ventes",
      title: "Délai de signature et impact sur le time-to-close",
      description:
        "Temps entre l'envoi du contrat et la signature effective. Croisement avec closedate du deal HubSpot pour mesurer le poids de la signature dans le cycle.",
      metrics: [
        "Temps moyen envoi → signature (jours)",
        "Taux de signature au 1er envoi",
        "Nb de relances nécessaires avant signature",
        "% du cycle total passé en phase signature",
      ],
      expectedValue:
        "Réduisez le cycle de vente en optimisant la phase de signature.",
      priority: "high",
      icon: "✍️",
    },
    {
      category: "esign",
      displayCategory: "chiffre_affaires",
      title: "Contrats abandonnés et revenue perdu",
      description:
        "Deals passés en 'Contract Sent' mais jamais signés. Montant total du pipeline perdu en phase de signature.",
      metrics: [
        "Nb de contrats non signés (>30j)",
        "Montant total des contrats abandonnés (€)",
        "Taux d'abandon par segment / taille de deal",
        "Top commerciaux par taux d'abandon contrat",
      ],
      expectedValue:
        "Récupérez du CA bloqué en phase de signature.",
      priority: "high",
      icon: "📉",
    },
  ],

  // ===== BILLING =====
  billing: [
    {
      category: "billing",
      displayCategory: "facturation_paiement",
      title: "Réconciliation Deals gagnés vs Factures émises",
      description:
        "Croise les deals HubSpot Closed Won (amount, closedate) avec la table invoices (Supabase) pour identifier les écarts entre forecast et facturation réelle.",
      metrics: [
        "CA forecast HubSpot vs facturé réel (€)",
        "Nb de deals Won sans facture associée",
        "Écart moyen forecast vs facturé (%)",
        "Délai moyen Closed Won → 1re facture émise (jours)",
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
        "Calcul du MRR/ARR à partir de la table subscriptions (Supabase). Ventilation par plan, par cohorte et évolution mensuelle.",
      metrics: [
        "MRR total actuel (€)",
        "ARR extrapolé (€)",
        "MRR par plan / offre",
        "Évolution MRR mois par mois (%, €)",
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
        "Volume de paiements traités via la table payments (Supabase). Taux de succès, échecs, montants en souffrance et relances.",
      metrics: [
        "Nb de paiements réussis vs échoués",
        "Taux de succès global (%)",
        "Montant total en échec (€)",
        "Taux de récupération après relance (dunning)",
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
        "Factures émises mais non réglées, classées par ancienneté (30j, 60j, 90j+). Croisement invoices × payments (Supabase).",
      metrics: [
        "Montant total impayé (€)",
        "Ventilation par tranche d'ancienneté",
        "Top 10 clients par encours",
        "Nb de factures impayées > 90 jours",
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
        "Suivi du churn MRR (annulations) et de la contraction (downgrades) à partir de subscriptions (Supabase). Ventilation par cohorte.",
      metrics: [
        "Churn MRR mensuel (€)",
        "Taux de churn gross (%)",
        "Contraction MRR (downgrades, €)",
        "Net Revenue Retention (%)",
      ],
      expectedValue:
        "Identifiez les cohortes à risque et agissez avant le churn massif.",
      priority: "high",
      icon: "📉",
    },
    {
      category: "billing",
      displayCategory: "chiffre_affaires",
      title: "Expansion revenue — upsells & cross-sells",
      description:
        "Revenue additionnel généré par les clients existants : upgrades de plan, ajout de licences. Données subscriptions (Supabase).",
      metrics: [
        "Expansion MRR mensuel (€)",
        "Nb de clients ayant upgradé",
        "Revenu moyen par upgrade (€)",
        "% de clients en expansion vs stables",
      ],
      expectedValue:
        "Maximisez le revenu sur la base client installée.",
      priority: "medium",
      icon: "🚀",
    },
  ],

  // ===== SUPPORT =====
  support: [
    {
      category: "support",
      displayCategory: "service_client",
      title: "Volume et résolution des tickets support",
      description:
        "Analyse des tickets (/crm/v3/objects/tickets ou table tickets Supabase) : volume, temps de première réponse, temps de résolution, statut.",
      metrics: [
        "Nb de tickets ouverts / fermés par période",
        "Temps de première réponse moyen (h)",
        "Temps de résolution moyen (h)",
        "Taux de résolution au 1er contact (%)",
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
        "Répartition des tickets par canal d'entrée (email, chat, téléphone) et par niveau de priorité.",
      metrics: [
        "Nb de tickets par canal",
        "Temps de résolution par canal (h)",
        "% de tickets haute priorité",
        "Évolution du volume par canal (tendance)",
      ],
      expectedValue:
        "Optimisez l'allocation des agents support par canal.",
      priority: "medium",
      icon: "📊",
    },
    {
      category: "support",
      displayCategory: "service_client",
      title: "Corrélation tickets ouverts → risque de churn",
      description:
        "Croise le nb de tickets récents par company avec les données de subscription pour identifier les comptes à risque.",
      metrics: [
        "Nb de tickets ouverts par company (30 derniers jours)",
        "Tickets ouverts à 30j du renouvellement",
        "MRR des comptes avec tickets critiques (€)",
        "Score de risque churn par company",
      ],
      expectedValue:
        "Détection précoce du churn via les signaux support.",
      priority: "high",
      icon: "🚨",
    },
    {
      category: "support",
      displayCategory: "service_client",
      title: "CSAT proxy — satisfaction client estimée",
      description:
        "Score de satisfaction estimé à partir du ratio tickets résolus / tickets totaux, temps de résolution et volume de réouvertures.",
      metrics: [
        "Score CSAT proxy global (%)",
        "CSAT proxy par agent support",
        "Taux de réouverture de tickets (%)",
        "Évolution mensuelle du CSAT proxy",
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
        "Compare les engagements (calls, meetings) sur deals Won vs Lost. Corrélation entre nb de touchpoints et issue du deal.",
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
        "Corrélation entre le nb de meetings logués (/crm/v3/objects/meetings) et le taux de Closed Won + montant moyen.",
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
        "Nb d'emails logués par deal (/crm/v3/objects/emails) et corrélation avec la durée du cycle de vente.",
      metrics: [
        "Nb moyen d'emails par deal",
        "Taux de réponse email par deal (hs_sales_email_last_replied)",
        "Durée du cycle pour deals avec réponse email rapide vs lente",
        "Nb de touchpoints email avant Closed Won",
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
        "Volume d'emails envoyés/reçus par hubspot_owner_id. Classement des commerciaux par activité email.",
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
        "Impact des meetings logués (/crm/v3/objects/meetings) sur la création et la progression des deals dans le pipeline.",
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
        "Contacts HubSpot dont la source (hs_analytics_source) est SOCIAL ou associés à des engagements LinkedIn.",
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
        "Revenue des deals Closed Won dont le contact d'origine a une source SOCIAL. Croisement deal → contact → hs_analytics_source.",
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
      "Distribution des contacts CRM par hubspot_owner_id (/crm/v3/objects/contacts). Détecte les déséquilibres dans l'attribution.",
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
      "Distribution des deals actifs par hubspot_owner_id (/crm/v3/objects/deals). Vue par pipeline et par montant.",
    metrics: [
      "Nb de deals par owner",
      "Montant total du pipeline par owner (€)",
      "Nb de deals sans owner",
      "Deals par owner par pipeline",
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
      "Distribution des companies par hubspot_owner_id (/crm/v3/objects/companies). Vue par industrie et par annual_revenue.",
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
      "Nombre et montant (amount) des deals en is_closed_won par mois. Données /crm/v3/objects/deals filtrées sur dealstage = closedwon.",
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
      "Répartition du CA Closed Won par pipeline HubSpot (/crm/v3/pipelines/deals). Identifie les pipelines les plus rentables.",
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
      "Classement des commerciaux par CA Closed Won (amount × hubspot_owner_id). Vue mensuelle et cumulative.",
    metrics: [
      "CA Closed Won par owner (€)",
      "Nb de deals Won par owner",
      "Deal moyen par owner (€)",
      "% d'atteinte de quota par owner",
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
      "Compare le pipeline weighted (dealstage × amount × probability) au CA réellement closé. Mesure la fiabilité du forecast.",
    metrics: [
      "Pipeline weighted total (€)",
      "CA réalisé Closed Won (€)",
      "Écart forecast vs réalisé (%)",
      "Précision du forecast par owner",
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
      "Synthèse des factures émises, payées et en attente par mois. Données table invoices (Supabase).",
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
      "Tickets créés dans HubSpot (/crm/v3/objects/tickets) : volume, statut, pipeline support.",
    metrics: [
      "Nb de tickets ouverts / fermés par mois",
      "Temps moyen de résolution (jours)",
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
    title: "Audit de complétude des champs CRM",
    description:
      "Pour chaque champ critique (email, phone, company, jobtitle, lifecyclestage), quel % est rempli dans /crm/v3/objects/contacts.",
    metrics: [
      "Complétude par champ clé (%)",
      "Champs les moins remplis (bottom 5)",
      "Complétude par lifecycle stage",
      "Évolution de la complétude mois par mois",
    ],
    expectedValue:
      "Priorisez l'enrichissement sur les champs qui impactent le plus le business.",
    priority: "high",
    icon: "🔍",
  },
  {
    category: "other",
    displayCategory: "qualite_donnees",
    title: "Deals sans contact ou sans company associés",
    description:
      "Deals HubSpot sans association contact ou company. Données /crm/v3/objects/deals → associations.",
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
  {
    category: "other",
    displayCategory: "qualite_donnees",
    title: "Contacts avec lifecycle stage incohérent",
    description:
      "Contacts dont le lifecyclestage ne correspond pas à leur situation réelle (ex: 'Lead' avec un deal Closed Won).",
    metrics: [
      "Nb de contacts avec lifecycle incohérent",
      "Types d'incohérences les plus fréquents",
      "Contacts 'Lead' avec deal Won",
      "Contacts 'Customer' sans deal Won",
    ],
    expectedValue:
      "Nettoyez les lifecycle stages pour un scoring et un routing fiables.",
    priority: "medium",
    icon: "🔄",
  },

  // --- ADOPTION OUTILS ---
  {
    category: "other",
    displayCategory: "adoption_outils",
    title: "Adoption du stack par utilisateur",
    description:
      "Pour chaque owner HubSpot, quels outils connectés il utilise réellement (source_links Supabase). Détecte les outils sous-exploités.",
    metrics: [
      "% d'adoption par outil et par user",
      "Top 3 outils sous-utilisés",
      "Users à former en priorité",
      "Score d'adoption global de l'équipe",
    ],
    expectedValue:
      "Maximisez le ROI de la stack en adressant la conduite du changement.",
    priority: "medium",
    icon: "👥",
  },
  {
    category: "other",
    displayCategory: "adoption_outils",
    title: "Évolution de l'adoption dans le temps",
    description:
      "Courbe d'adoption de chaque outil connecté semaine par semaine. Détecte les outils en déclin (source_links Supabase).",
    metrics: [
      "Adoption semaine N vs N-1 par outil",
      "Outils en croissance d'adoption",
      "Outils en déclin d'adoption",
      "Taux d'adoption global (%)",
    ],
    expectedValue:
      "Anticipez le désengagement et agissez avant la perte du ROI.",
    priority: "medium",
    icon: "📈",
  },
  {
    category: "other",
    displayCategory: "adoption_outils",
    title: "Connexions CRM par utilisateur",
    description:
      "Fréquence de connexion au CRM HubSpot par owner. Identifie les utilisateurs qui n'utilisent pas le CRM.",
    metrics: [
      "Nb de connexions par user / semaine",
      "Dernière connexion par user",
      "Users inactifs depuis 7+ jours",
      "Corrélation adoption CRM ↔ performance commerciale",
    ],
    expectedValue:
      "Détectez les commerciaux qui ne logent pas leur activité.",
    priority: "low",
    icon: "🔑",
  },

  // --- CYCLE DE VENTES ---
  {
    category: "other",
    displayCategory: "cycle_ventes",
    title: "Vélocité du cycle de vente par pipeline",
    description:
      "Temps moyen par étape de pipeline (/crm/v3/pipelines/deals + hs_time_in_latest_deal_stage). Identification des goulots d'étranglement.",
    metrics: [
      "Durée moyenne par étape (jours)",
      "Étapes les plus lentes (>21 jours)",
      "Vélocité totale du pipeline (jours)",
      "Comparaison par pipeline",
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
      "Taux de passage d'une étape à la suivante dans chaque pipeline. Données /crm/v3/objects/deals groupées par dealstage.",
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
      "Deals ouverts depuis plus de N jours sans changement de stage (hs_time_in_latest_deal_stage). Montant à risque.",
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
      "Prévision du CA basée sur le montant pondéré par la probabilité de chaque stage. Données deals × pipeline stages.",
    metrics: [
      "Pipeline weighted total (€)",
      "Pipeline weighted par mois de closing attendu",
      "Pipeline weighted par owner",
      "Couverture pipeline vs objectif (%)",
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
