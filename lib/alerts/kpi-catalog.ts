// Catalogue des KPIs suggérés par équipe — partagé entre le formulaire de
// création d'alerte (étape KPI) et les tuiles KPI configurables des pages.
// Chaque id correspond à un forecast_type résolu par resolveKpiValue().

export const teams = [
  { id: "sales", label: "Ventes", icon: "💼", description: "Pipeline, deals, closing" },
  { id: "marketing", label: "Marketing", icon: "📣", description: "Leads, conversion, acquisition" },
  { id: "cs", label: "Service client", icon: "🤝", description: "Rétention, churn, satisfaction" },
  { id: "revops", label: "Finance", icon: "📊", description: "Pilotage revenue, données & process" },
  // (« Opération » retirée du formulaire — ses KPIs data quality restent servis
  // aux tuiles de la page Audit données via kpisByTeam.ops.)
];

export type KpiDef = {
  id: string;
  label: string;
  description: string;
  defaultUnit: "percent" | "currency" | "count";
  defaultDirection: "above" | "below";
  category: string;
  dealRelated: boolean;
  contactRelated?: boolean;
  sourceRelated?: boolean;
};

export const kpisByTeam: Record<string, KpiDef[]> = {
  sales: [
    // ── Performance closing ──
    { id: "closing_rate", label: "Closing rate", description: "% de deals gagnés sur les deals clôturés — le KPI roi de la performance commerciale", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "revenue_won", label: "CA signé", description: "Chiffre d'affaires total des deals gagnés", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deals_won_count", label: "Deals gagnés", description: "Nombre de deals remportés — volume de closing", defaultUnit: "count", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "avg_deal_size", label: "Panier moyen", description: "Montant moyen des deals gagnés — levier de croissance", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    // ── Santé du pipeline ──
    { id: "pipeline_value", label: "Valeur pipeline", description: "Montant total des deals ouverts — capacité de projection revenue", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "weighted_pipeline", label: "Pipeline pondéré", description: "Somme des montants × probabilité de gain — forecast réaliste", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "pipeline_coverage", label: "Couverture pipeline", description: "% de deals avec une activité planifiée — discipline commerciale", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deal_activation", label: "Activation deals", description: "% de deals en cours avec au moins une activité — pipeline réellement travaillé", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    // ── Vélocité & risque ──
    { id: "sales_cycle_days", label: "Cycle de vente moyen", description: "Nombre de jours moyen entre création et closing — indicateur de vélocité", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "stagnant_deals", label: "Deals stagnants", description: "Deals sans activité depuis 7 jours — risque de perte silencieuse", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "deals_at_risk", label: "Deals à risque", description: "Deals flagués à risque — nécessitent une action immédiate", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "deals_no_amount", label: "Deals sans montant", description: "Deals sans montant renseigné — forecast aveugle", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
  ],
  marketing: [
    // ── Conversion funnel ──
    { id: "conversion_rate", label: "Taux de conversion Lead→Opp", description: "% de contacts convertis en opportunités — efficacité du funnel", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "mql_to_sql_rate", label: "Conversion MQL→SQL", description: "% de MQL acceptés par les sales — alignement marketing-ventes", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "deals_count", label: "Deals créés", description: "Volume de deals créés — contribution marketing au pipeline", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: true },
    // ── Sources d'acquisition ──
    { id: "contacts_by_source", label: "Contacts par source", description: "Volume de contacts acquis via une ou plusieurs sources d'origine", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    { id: "source_to_lifecycle", label: "Source → Lifecycle", description: "% de contacts d'une source qui atteignent une phase du cycle de vie — ROI par canal", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    { id: "source_to_deal_created", label: "Source → Deal créé", description: "Contacts d'une source ayant généré un deal — contribution au pipeline par canal", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    { id: "source_to_deal_won", label: "Source → Deal gagné", description: "Contacts d'une source dont le deal a été gagné — ROI revenue par canal", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    // ── Qualité base contacts ──
    { id: "orphan_rate", label: "Taux d'orphelins", description: "% de contacts sans entreprise associée — risque de segmentation ABM", defaultUnit: "percent", defaultDirection: "below", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "phone_enrichment", label: "Enrichissement tél.", description: "% de contacts avec numéro de téléphone — capacité outbound multicanal", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "dormant_reactivation", label: "Contacts dormants", description: "Contacts sans interaction depuis 6 mois — base à réactiver", defaultUnit: "count", defaultDirection: "below", category: "marketing", dealRelated: false, contactRelated: true },
  ],
  cs: [
    // ── Rétention & risque ──
    { id: "deals_at_risk", label: "Comptes à risque", description: "Deals flagués à risque — action proactive CSM requise", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "stagnant_deals", label: "Deals sans suivi", description: "Deals sans activité depuis 7 jours — engagement client à risque", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "dormant_reactivation", label: "Clients dormants", description: "Contacts sans interaction depuis 6 mois — comptes à réengager avant qu'ils ne churment", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: false, contactRelated: true },
    // ── Expansion ──
    { id: "avg_deal_size", label: "Panier moyen", description: "Montant moyen des deals — suivi de l'upsell/cross-sell", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deals_won_count", label: "Renouvellements gagnés", description: "Nombre de deals gagnés — volume de rétention", defaultUnit: "count", defaultDirection: "above", category: "sales", dealRelated: true },
  ],
  revops: [
    // ── Radar de facturation (rapprochement CRM ↔ facturation) ──
    { id: "billing_radar_overdue", label: "Factures attendues non émises", description: "Radar de facturation : factures en retard vs le rythme réel de chaque client et les fins de contrat CRM — trésorerie qui dort", defaultUnit: "count", defaultDirection: "above", category: "finance", dealRelated: false },
    { id: "won_unbilled_count", label: "Deals gagnés non facturés", description: "Deals gagnés depuis plus de 15 jours sans première facture émise — la fuite entre closing et facturation", defaultUnit: "count", defaultDirection: "above", category: "finance", dealRelated: true },
    // ── Délais cash (réconciliés CRM × facturation) ──
    { id: "deal_won_to_first_invoice", label: "Délai closing → 1re facture", description: "Jours médians entre le deal gagné et la première facture émise — la latence qui retarde le cash", defaultUnit: "count", defaultDirection: "below", category: "finance", dealRelated: true },
    { id: "invoice_to_payment", label: "Délai facture → paiement (DSO)", description: "Jours médians entre l'émission d'une facture et son encaissement — le DSO réel mesuré sur tes factures", defaultUnit: "count", defaultDirection: "below", category: "finance", dealRelated: false },
    // ── Revenue & forecast ──
    { id: "revenue_won", label: "Revenue cumulé", description: "CA total signé — KPI de pilotage N°1 pour le board", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "weighted_pipeline", label: "Forecast pondéré", description: "Pipeline × probabilité — prévision revenue la plus fiable", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "pipeline_value", label: "Pipeline total", description: "Valeur totale du pipeline ouvert — capacité de croissance", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "closing_rate", label: "Closing rate global", description: "Taux de closing tous pipelines — efficacité commerciale globale", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "avg_deal_size", label: "Panier moyen", description: "Montant moyen des deals gagnés — pilotage du mix revenue", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deals_won_count", label: "Deals gagnés", description: "Volume de deals signés — base pour réconciliation forecast vs facturation", defaultUnit: "count", defaultDirection: "above", category: "sales", dealRelated: true },
    // ── Risque & vélocité cash ──
    { id: "deals_at_risk", label: "Comptes à risque", description: "Deals/comptes flagués à risque — proxy churn signal", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "sales_cycle_days", label: "Cycle de vente moyen", description: "Jours entre création et closing — vélocité du cash entrant", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
  ],
  ops: [
    // ── Qualité & intégrité des données ──
    { id: "duplicate_rate", label: "Taux de doublons", description: "% de contacts en doublon (même email) — hygiène et déduplication de la base", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    { id: "data_completeness", label: "Complétude des données", description: "% de deals avec montant + date de closing + propriétaire — fiabilité des analyses", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: true },
    { id: "orphan_rate", label: "Contacts orphelins", description: "% de contacts sans entreprise associée — intégrité du rattachement", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    { id: "phone_enrichment", label: "Enrichissement téléphone", description: "% de contacts avec numéro renseigné — complétude pour l'outbound", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: false, contactRelated: true },
    { id: "deals_no_amount", label: "Deals sans montant", description: "Deals ouverts sans montant renseigné — forecast aveugle", defaultUnit: "count", defaultDirection: "below", category: "data", dealRelated: true },
    { id: "dormant_reactivation", label: "Contacts dormants", description: "Contacts sans interaction depuis 6 mois — base à nettoyer ou réactiver", defaultUnit: "count", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
  ],
};

export const unitLabels: Record<string, string> = { percent: "%", currency: "€", count: "" };
