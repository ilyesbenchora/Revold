/**
 * Cross-source report suggestions — reports that combine 2+ different
 * tool categories (CRM x billing, outbound x calling x billing, etc.).
 *
 * These are the reports that justify Revold's existence: no single connected
 * tool can produce them alone. All KPIs reference real HubSpot API endpoints
 * + canonical Supabase tables (invoices, subscriptions, payments, tickets,
 * source_links).
 */

import type { DetectedIntegration } from "@/lib/integrations/detect-integrations";
import {
  getToolCategory,
  type ToolCategory,
  type ReportDisplayCategory,
} from "./report-suggestions";

export type CrossSourceReport = {
  id: string;
  title: string;
  description: string;
  displayCategory: ReportDisplayCategory;
  requiredCategories: ToolCategory[];
  metrics: string[];
  expectedValue: string;
  priority: "high" | "medium" | "low";
  icon: string;
  /** Reliability % = min enrichment rate across required tool categories
   *  (weakest link in the cross-source chain). Computed dynamically. */
  reliabilityPct: number;
};

// ---------------------------------------------------------------------------
// CROSS-SOURCE TEMPLATES — 25+ reports across all 7 categories
// ---------------------------------------------------------------------------
const CROSS_SOURCE_TEMPLATES: Omit<CrossSourceReport, "reliabilityPct">[] = [
  // =====================================================================
  //  ATTRIBUTION (4 reports)
  // =====================================================================
  {
    id: "cross_attribution_outbound_owner",
    displayCategory: "attribution",
    title: "Attribution outbound vs CRM par commercial",
    description:
      "Croise les contacts acquis via outbound (Lemlist/Apollo) avec l'attribution CRM HubSpot (hubspot_owner_id). Identifie les contacts outbound non attribues ou mal routes.",
    requiredCategories: ["outbound"],
    metrics: [
      "Nb de contacts outbound par owner HubSpot",
      "% de contacts outbound sans owner",
      "Delai moyen entre creation outbound et attribution owner",
      "Taux de reassignation de contacts outbound",
    ],
    expectedValue:
      "Assurez que chaque lead outbound est attribue au bon commercial sans delai.",
    priority: "high",
    icon: "🎯",
  },
  {
    id: "cross_attribution_enrichment_coverage",
    displayCategory: "attribution",
    title: "Couverture d'enrichissement par portefeuille commercial",
    description:
      "Croise les donnees d'enrichissement (Kaspr/Dropcontact) avec les portefeuilles par owner. Identifie les owners dont les contacts sont les moins enrichis.",
    requiredCategories: ["enrichment"],
    metrics: [
      "% de contacts enrichis par owner",
      "Champs manquants par portefeuille",
      "Score de qualite des contacts par owner",
      "Owners a prioriser pour l'enrichissement",
    ],
    expectedValue:
      "Ciblez l'enrichissement sur les portefeuilles les moins complets.",
    priority: "medium",
    icon: "📊",
  },
  {
    id: "cross_attribution_calling_owner",
    displayCategory: "attribution",
    title: "Attribution des appels par commercial vs deals associes",
    description:
      "Croise les appels passes (Aircall/Ringover) avec les deals HubSpot par owner. Verifie que les appels sont loges sur les bons deals.",
    requiredCategories: ["calling"],
    metrics: [
      "Nb d'appels par owner avec deal associe vs sans",
      "% d'appels sans deal associe",
      "Appels sur deals d'un autre owner",
      "Volume d'appels non traces dans le CRM",
    ],
    expectedValue:
      "Fiabilisez le tracking des appels pour un reporting exact.",
    priority: "medium",
    icon: "📞",
  },
  {
    id: "cross_attribution_support_companies",
    displayCategory: "attribution",
    title: "Attribution support vs CRM — comptes sans CSM",
    description:
      "Croise les tickets support (Intercom/Zendesk) avec les companies HubSpot. Identifie les comptes clients avec tickets mais sans owner CRM (pas de CSM attribue).",
    requiredCategories: ["support"],
    metrics: [
      "Nb de companies avec tickets sans owner CRM",
      "MRR des comptes sans CSM attribue (€)",
      "Tickets sur comptes non geres",
      "Delai moyen de resolution sur comptes sans CSM vs avec",
    ],
    expectedValue:
      "Attribuez un CSM a chaque compte client actif.",
    priority: "high",
    icon: "🏢",
  },

  // =====================================================================
  //  CHIFFRE D'AFFAIRES (4 reports)
  // =====================================================================
  {
    id: "cross_ca_outbound_to_revenue",
    displayCategory: "chiffre_affaires",
    title: "Outbound → Opportunites → CA encaisse",
    description:
      "Funnel complet : campagnes outbound (Lemlist/Apollo) → contacts CRM → deals HubSpot → factures encaissees (Stripe/Pennylane). Le ROI reel par sequence.",
    requiredCategories: ["outbound", "billing"],
    metrics: [
      "CA encaisse attribue a l'outbound (€)",
      "CAC par canal outbound",
      "Cycle moyen first-touch outbound → 1re facture (jours)",
      "% de leads outbound qui paient effectivement",
    ],
    expectedValue:
      "Identifiez les sequences outbound qui generent du cash reel.",
    priority: "high",
    icon: "💰",
  },
  {
    id: "cross_ca_calling_to_revenue",
    displayCategory: "chiffre_affaires",
    title: "Appels → Deals gagnes → Revenue encaisse",
    description:
      "Croise l'activite Aircall/Ringover avec les deals HubSpot Closed Won et les factures encaissees. Mesure le CA reel genere par le canal telephonique.",
    requiredCategories: ["calling", "billing"],
    metrics: [
      "CA encaisse sur deals avec appels (€)",
      "Nb d'appels moyen par deal encaisse",
      "ROI du canal telephone (CA / cout outil)",
      "Top 5 commerciaux par CA telephone → encaissement",
    ],
    expectedValue:
      "Quantifiez la valeur reelle du telephone en euros encaisses.",
    priority: "high",
    icon: "📞",
  },
  {
    id: "cross_ca_esign_to_invoice",
    displayCategory: "chiffre_affaires",
    title: "Signature electronique → Facturation → Encaissement",
    description:
      "Temps entre signature du contrat (PandaDoc/Yousign) → emission de la facture → encaissement. Identifie les fuites entre signature et cash.",
    requiredCategories: ["esign", "billing"],
    metrics: [
      "Delai moyen signature → 1re facture (jours)",
      "Delai moyen facture → encaissement (jours)",
      "Contrats signes sans facture emise (€)",
      "Taux de conversion signature → encaissement (%)",
    ],
    expectedValue:
      "Eliminez les fuites entre la signature et l'encaissement.",
    priority: "high",
    icon: "✍️",
  },
  {
    id: "cross_ca_social_selling_revenue",
    displayCategory: "chiffre_affaires",
    title: "Social Selling → Pipeline → CA encaisse",
    description:
      "Mesure le CA encaisse sur les deals dont le contact d'origine a une source SOCIAL (LinkedIn). Croisement contacts → deals → factures.",
    requiredCategories: ["social_selling", "billing"],
    metrics: [
      "CA encaisse source LinkedIn (€)",
      "Nb de deals Won source SOCIAL",
      "Deal moyen social vs autres canaux (€)",
      "ROI Sales Navigator (CA / licence)",
    ],
    expectedValue:
      "Justifiez l'investissement LinkedIn avec le CA reel encaisse.",
    priority: "medium",
    icon: "💼",
  },

  // =====================================================================
  //  FACTURATION & PAIEMENT (4 reports)
  // =====================================================================
  {
    id: "cross_fact_deals_vs_invoices",
    displayCategory: "facturation_paiement",
    title: "Reconciliation Deals gagnes ↔ Factures encaissees",
    description:
      "Croise systematiquement chaque deal HubSpot Closed Won (amount, closedate) avec les factures et paiements (tables invoices, payments Supabase). Identifie les fuites de revenue.",
    requiredCategories: ["billing"],
    metrics: [
      "Forecast HubSpot vs CA reel encaisse (€)",
      "Deals Won sans facture associee (nb + €)",
      "Ecart % par commercial",
      "Delai moyen Won → 1re facture emise (jours)",
    ],
    expectedValue:
      "Recuperez le CA deja signe et fiabilisez le forecast a 100%.",
    priority: "high",
    icon: "💎",
  },
  {
    id: "cross_fact_mrr_churn",
    displayCategory: "facturation_paiement",
    title: "MRR / ARR & churn par cohorte client",
    description:
      "Suivi des revenus recurrents (subscriptions Supabase) croises avec les companies HubSpot. Ventilation MRR par cohorte d'acquisition, expansion, contraction et churn.",
    requiredCategories: ["billing"],
    metrics: [
      "MRR total / ARR (€)",
      "Net Revenue Retention par cohorte (%)",
      "Churn rate mensuel (%)",
      "Expansion MRR (€) vs Contraction MRR (€)",
    ],
    expectedValue:
      "Pilotez la sante du business recurrent avec une vue cohorte.",
    priority: "high",
    icon: "📈",
  },
  {
    id: "cross_fact_payment_success",
    displayCategory: "facturation_paiement",
    title: "Taux de succes des paiements × profil client",
    description:
      "Croise le taux de succes des paiements (payments Supabase) avec les proprietes company HubSpot (industry, annual_revenue) pour identifier les segments a risque de defaut.",
    requiredCategories: ["billing"],
    metrics: [
      "Taux de succes global des paiements (%)",
      "Taux de succes par industrie",
      "Taux de succes par tranche de CA annuel",
      "Montant total en echec de paiement (€)",
    ],
    expectedValue:
      "Anticipez les defauts de paiement par segment client.",
    priority: "high",
    icon: "💳",
  },
  {
    id: "cross_fact_outstanding_by_owner",
    displayCategory: "facturation_paiement",
    title: "Encours client par commercial",
    description:
      "Factures impayees (invoices Supabase) ventilees par hubspot_owner_id du deal ou de la company CRM. Identifie quels portefeuilles ont le plus d'impayes.",
    requiredCategories: ["billing"],
    metrics: [
      "Encours total par owner (€)",
      "Nb de factures impayees par owner",
      "Anciennete moyenne des impayes par owner",
      "Top 5 owners par encours",
    ],
    expectedValue:
      "Responsabilisez les commerciaux sur le recouvrement.",
    priority: "medium",
    icon: "🧾",
  },

  // =====================================================================
  //  SERVICE CLIENT (4 reports)
  // =====================================================================
  {
    id: "cross_service_tickets_churn",
    displayCategory: "service_client",
    title: "Tickets support → Risque de churn MRR",
    description:
      "Croise le volume de tickets (Intercom/Zendesk) avec le MRR des comptes (subscriptions Supabase). Identifie les comptes a haut MRR avec des tickets critiques ouverts.",
    requiredCategories: ["support", "billing"],
    metrics: [
      "MRR a risque sur comptes avec tickets critiques (€)",
      "Tickets ouverts a 30j du renouvellement",
      "Comptes Tier 1 avec ticket urgent",
      "Score de sante predictif par company",
    ],
    expectedValue:
      "Detectez le churn 60 jours avant qu'il arrive.",
    priority: "high",
    icon: "🚨",
  },
  {
    id: "cross_service_resolution_vs_nrr",
    displayCategory: "service_client",
    title: "Temps de resolution vs Net Revenue Retention",
    description:
      "Correlation entre le temps de resolution moyen des tickets par company et le NRR (expansion - churn). Les comptes avec un support lent churnent-ils plus ?",
    requiredCategories: ["support", "billing"],
    metrics: [
      "Temps de resolution moyen par company (h)",
      "NRR par tranche de temps de resolution (%)",
      "Correlation resolution ↔ churn (coefficient)",
      "Comptes avec resolution lente et MRR > 1000€",
    ],
    expectedValue:
      "Prouvez l'impact du service client sur la retention revenue.",
    priority: "high",
    icon: "⏱️",
  },
  {
    id: "cross_service_csat_engagement",
    displayCategory: "service_client",
    title: "CSAT proxy × engagement commercial",
    description:
      "Croise le score CSAT proxy (tickets) avec l'activite commerciale (emails, calls, meetings HubSpot) par company. Les comptes bien suivis commercialement ont-ils moins de tickets ?",
    requiredCategories: ["support"],
    metrics: [
      "CSAT proxy par company",
      "Nb de touchpoints commerciaux par company",
      "Correlation touchpoints ↔ CSAT",
      "Comptes a faible CSAT et faible engagement",
    ],
    expectedValue:
      "Identifiez les comptes qui manquent d'attention commerciale et support.",
    priority: "medium",
    icon: "⭐",
  },
  {
    id: "cross_service_tickets_by_source",
    displayCategory: "service_client",
    title: "Tickets par source d'acquisition du client",
    description:
      "Croise les tickets support avec la source d'acquisition du contact (hs_analytics_source). Les clients outbound generent-ils plus de tickets que les inbound ?",
    requiredCategories: ["support"],
    metrics: [
      "Nb moyen de tickets par source d'acquisition",
      "Temps de resolution par source",
      "Taux de reouverture par source",
      "MRR moyen par source × nb de tickets",
    ],
    expectedValue:
      "Ajustez les attentes support selon le canal d'acquisition.",
    priority: "low",
    icon: "📊",
  },

  // =====================================================================
  //  QUALITE DE DONNEES (4 reports)
  // =====================================================================
  {
    id: "cross_qualite_enrichment_roi",
    displayCategory: "qualite_donnees",
    title: "ROI de l'enrichissement × taux de conversion",
    description:
      "Compare la performance commerciale (taux de reponse, opportunites, deals Won) entre contacts enrichis (Kaspr/Dropcontact) et non-enrichis. Quantifie le ROI exact.",
    requiredCategories: ["enrichment", "billing"],
    metrics: [
      "Taux de conversion enrichi vs non-enrichi (%)",
      "CA moyen sur deals avec contacts enrichis (€)",
      "ROI net par outil d'enrichissement (€/€ investi)",
      "% de la base a enrichir prioritairement",
    ],
    expectedValue:
      "Justifiez ou reduisez le budget enrichissement avec des chiffres exacts.",
    priority: "high",
    icon: "💎",
  },
  {
    id: "cross_qualite_duplicates_impact",
    displayCategory: "qualite_donnees",
    title: "Impact des doublons sur le pipeline",
    description:
      "Croise les contacts en doublon avec les deals associes. Mesure combien de revenue est fausse par les doublons (meme deal attribue 2 fois, etc.).",
    requiredCategories: ["enrichment"],
    metrics: [
      "Nb de deals associes a des contacts en doublon",
      "Montant du pipeline potentiellement fausse (€)",
      "Doublons par source d'acquisition",
      "Impact sur le forecast (%)",
    ],
    expectedValue:
      "Nettoyez les doublons qui faussent votre forecast.",
    priority: "high",
    icon: "🧹",
  },
  {
    id: "cross_qualite_orphans_outbound",
    displayCategory: "qualite_donnees",
    title: "Contacts outbound non rattaches au CRM",
    description:
      "Contacts crees par les outils outbound (Lemlist/Apollo) qui n'ont pas ete correctement importes ou rattaches dans HubSpot. Fuite de donnees.",
    requiredCategories: ["outbound"],
    metrics: [
      "Nb de contacts outbound absents du CRM",
      "% de contacts outbound sans association company",
      "Contacts outbound sans lifecycle stage",
      "Contacts outbound sans owner CRM",
    ],
    expectedValue:
      "Eliminez les fuites de donnees entre l'outbound et le CRM.",
    priority: "medium",
    icon: "🔗",
  },
  {
    id: "cross_qualite_field_completeness_billing",
    displayCategory: "qualite_donnees",
    title: "Completude CRM × donnees de facturation",
    description:
      "Croise la completude des champs CRM (email, phone, SIREN) avec les donnees de facturation. Les clients factures ont-ils des fiches CRM completes ?",
    requiredCategories: ["billing"],
    metrics: [
      "Completude moyenne des fiches clients factures (%)",
      "Champs manquants les plus frequents sur clients actifs",
      "Clients factures sans email dans le CRM",
      "Clients factures sans company associee",
    ],
    expectedValue:
      "Assurez que vos clients payants ont des fiches CRM completes.",
    priority: "medium",
    icon: "🔍",
  },

  // =====================================================================
  //  ADOPTION OUTILS (3 reports)
  // =====================================================================
  {
    id: "cross_adoption_stack_per_user",
    displayCategory: "adoption_outils",
    title: "Adoption du stack complet par utilisateur",
    description:
      "Vue cross-tools : pour chaque owner HubSpot, quels outils connectes il utilise reellement (Aircall, Kaspr, PandaDoc, etc.) et lesquels sont sous-exploites. Donnees source_links Supabase.",
    requiredCategories: [],
    metrics: [
      "% d'adoption par outil et par user",
      "Top 3 outils sous-utilises",
      "Users a former en priorite",
      "Score d'adoption global de l'equipe",
    ],
    expectedValue:
      "Maximisez le ROI de la stack en formant les bons users.",
    priority: "medium",
    icon: "👥",
  },
  {
    id: "cross_adoption_correlation_performance",
    displayCategory: "adoption_outils",
    title: "Correlation adoption outils × performance commerciale",
    description:
      "Les commerciaux qui utilisent le plus d'outils generent-ils plus de CA ? Croise le score d'adoption par user avec le CA Closed Won.",
    requiredCategories: [],
    metrics: [
      "Score d'adoption par owner",
      "CA Closed Won par owner (€)",
      "Correlation adoption ↔ CA (coefficient)",
      "Owners a fort potentiel (faible adoption, fort CA)",
    ],
    expectedValue:
      "Prouvez que l'adoption des outils impacte le CA.",
    priority: "medium",
    icon: "📈",
  },
  {
    id: "cross_adoption_tool_usage_trend",
    displayCategory: "adoption_outils",
    title: "Tendance d'utilisation par outil et par equipe",
    description:
      "Evolution de l'adoption de chaque outil semaine par semaine, segmentee par equipe commerciale. Detecte les outils en declin.",
    requiredCategories: [],
    metrics: [
      "Adoption semaine N vs N-1 par outil",
      "Outils en croissance vs en declin",
      "Equipes avec le meilleur taux d'adoption",
      "Outils abandonnes (<10% d'utilisation)",
    ],
    expectedValue:
      "Anticipez le desengagement avant la perte du ROI.",
    priority: "low",
    icon: "📉",
  },

  // =====================================================================
  //  CYCLE DE VENTES (5 reports)
  // =====================================================================
  {
    id: "cross_cycle_full_funnel_sdr",
    displayCategory: "cycle_ventes",
    title: "Performance full-funnel par SDR",
    description:
      "Pour chaque SDR : volume outbound (Lemlist/Apollo) → appels (Aircall) → meetings → deals crees → deals Won → CA encaisse (Stripe). La photo complete.",
    requiredCategories: ["outbound", "calling", "billing"],
    metrics: [
      "Activite quotidienne par SDR (emails, appels, meetings)",
      "Taux de conversion par etape du funnel",
      "Revenue genere par SDR (€)",
      "Cout d'acquisition par SDR (€)",
    ],
    expectedValue:
      "Coaching cible et identification rapide des decrocheurs.",
    priority: "high",
    icon: "🏆",
  },
  {
    id: "cross_cycle_esign_velocity",
    displayCategory: "cycle_ventes",
    title: "Impact de la signature electronique sur la velocite",
    description:
      "Croise les contrats PandaDoc/Yousign avec les deals HubSpot. Mesure le % du cycle total passe en phase de signature et les blocages.",
    requiredCategories: ["esign"],
    metrics: [
      "% du cycle de vente passe en phase signature",
      "Delai moyen envoi → signature par segment",
      "Taux d'abandon contrat par taille de deal",
      "Contrats relances vs signes du 1er coup",
    ],
    expectedValue:
      "Reduisez le cycle de vente de 15-30% sur la phase signature.",
    priority: "high",
    icon: "✍️",
  },
  {
    id: "cross_cycle_conv_intel_patterns",
    displayCategory: "cycle_ventes",
    title: "Patterns conversationnels × issue du deal",
    description:
      "Compare les engagements (calls, meetings, emails HubSpot) entre deals Won et Lost. Identifie le bon nombre de touchpoints et les patterns gagnants.",
    requiredCategories: ["conv_intel"],
    metrics: [
      "Nb moyen de touchpoints sur deals Won vs Lost",
      "Duree moyenne des calls sur deals Won (min)",
      "Ratio emails envoyes / reponses sur Won vs Lost",
      "Nb de notes logees (num_notes) sur deals Won vs Lost",
    ],
    expectedValue:
      "Formalisez la methode de vente basee sur les donnees.",
    priority: "medium",
    icon: "🎙️",
  },
  {
    id: "cross_cycle_meetings_pipeline_velocity",
    displayCategory: "cycle_ventes",
    title: "Impact des meetings sur la velocite du pipeline",
    description:
      "Correlation entre le nb de meetings par deal et la vitesse de progression dans le pipeline. Croise meetings HubSpot × hs_time_in_latest_deal_stage.",
    requiredCategories: ["meetings"],
    metrics: [
      "Nb moyen de meetings par deal Won",
      "Velocite du pipeline avec meetings vs sans (jours)",
      "Taux de show-up (meetings realises / planifies)",
      "Stage ou les meetings accelerent le plus la progression",
    ],
    expectedValue:
      "Optimisez le nombre de meetings pour accelerer le pipeline.",
    priority: "medium",
    icon: "📅",
  },
  {
    id: "cross_cycle_calling_stage_progression",
    displayCategory: "cycle_ventes",
    title: "Impact des appels sur la progression de stage",
    description:
      "Croise les appels passes (Aircall/Ringover) avec les changements de stage des deals HubSpot. Les appels accelerent-ils les passages de stage ?",
    requiredCategories: ["calling"],
    metrics: [
      "Nb d'appels moyen avant changement de stage",
      "Delai moyen entre appel et passage de stage (jours)",
      "Stages ou les appels ont le plus d'impact",
      "Taux de progression apres appel vs sans appel",
    ],
    expectedValue:
      "Identifiez a quel moment du cycle les appels sont les plus efficaces.",
    priority: "medium",
    icon: "📞",
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the cross-source reports relevant for the user's portal.
 * A report is relevant when ALL its required categories are detected.
 * Reports with empty `requiredCategories` are always shown.
 */
export function getCrossSourceReports(
  integrations: DetectedIntegration[],
): Array<CrossSourceReport & { availableCategories: ToolCategory[] }> {
  const presentCategories = new Set<ToolCategory>();
  // Compute enrichment per tool category for reliability
  const enrichmentByCategory = new Map<ToolCategory, number>();
  for (const i of integrations) {
    const cat = getToolCategory(i.key);
    if (cat === "other") continue;
    presentCategories.add(cat);
    const current = enrichmentByCategory.get(cat);
    // Keep the highest enrichment for each category (best tool wins)
    if (current === undefined || i.enrichmentRate > current) {
      enrichmentByCategory.set(cat, i.enrichmentRate);
    }
  }

  return CROSS_SOURCE_TEMPLATES.filter((tpl) => {
    if (tpl.requiredCategories.length === 0) return true;
    return tpl.requiredCategories.every((c) => presentCategories.has(c));
  })
    .map((tpl) => {
      // Reliability = min enrichment across required categories (weakest link)
      const enrichments = tpl.requiredCategories.map(
        (c) => enrichmentByCategory.get(c) ?? 0,
      );
      const reliabilityPct = enrichments.length > 0
        ? Math.min(...enrichments)
        : 70; // default for reports with no required category
      return {
        ...tpl,
        reliabilityPct,
        availableCategories: tpl.requiredCategories.filter((c) =>
          presentCategories.has(c),
        ),
      };
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
}

export function getAllCrossSourceTemplates(): Omit<CrossSourceReport, "reliabilityPct">[] {
  return CROSS_SOURCE_TEMPLATES;
}
