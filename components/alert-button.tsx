"use client";

type AlertButtonProps = {
  title: string;
  description: string;
  impact: string;
  category: string;
  forecastType?: string;
  threshold?: number;
  direction?: "above" | "below";
};

// category (de la sim) → team (CreateAlertModal funnel)
const TEAM_MAP: Record<string, string> = {
  sales: "sales",
  marketing: "marketing",
  csm: "cs",
  data: "revops",
  process: "revops",
};

// forecastType → kpiId du catalogue CreateAlertModal (best-effort).
// Si non mappé, l'user choisit le KPI manuellement à l'étape 2.
const KPI_MAP: Record<string, string> = {
  // Cycle ventes
  closing_rate: "closing_rate",
  pipeline_3x: "pipeline_value",
  pipeline_coverage: "pipeline_coverage",
  deal_activation: "deal_activation",
  weighted_pipeline: "weighted_pipeline",
  won_amount_growth: "revenue_won",
  avg_deal_size: "avg_deal_size",
  sales_cycle_days: "sales_cycle_days",
  stagnant_deals: "stagnant_deals",
  deals_at_risk: "deals_at_risk",
  cycle_reduction: "sales_cycle_days",
  forecast_accuracy: "weighted_pipeline",
  // Marketing
  conv_lead_to_mql: "mql_to_sql_rate",
  conv_mql_to_sql: "mql_to_sql_rate",
  conv_sql_to_opp: "conversion_rate",
  conv_opp_to_customer: "conversion_rate",
  marketing_contact_company_assoc: "orphan_rate",
  marketing_company_pipeline_assoc: "conversion_rate",
  deal_marketing_source: "source_to_deal_created",
  dormant_reactivation: "dormant_reactivation",
  // Data quality
  contact_company_assoc: "orphan_rate",
  company_deal_assoc: "conversion_rate",
  deal_contact_assoc: "data_completeness",
  offline_sources_reduce: "contacts_by_source",
  online_attribution_rate: "contacts_by_source",
  custom_props_audit: "data_completeness",
  top20_props_fill: "data_completeness",
  // Revenue
  forecast_vs_revenue_match: "revenue_won",
  won_without_invoice: "deals_won_count",
  mrr_growth: "revenue_won",
  pipeline_3x_revenue: "weighted_pipeline",
  churn_rate: "deals_at_risk",
};

/**
 * Bouton "Modifier cette alerte" affiché sur chaque simulation.
 *
 * Comportement : dispatch un CustomEvent `revold:open-alert-modal` que
 * `<CreateAlertModal />` (monté en haut de la page) écoute pour ouvrir le
 * funnel complet directement à l'étape "Objectif" (step 3) avec les valeurs
 * pré-remplies depuis la simulation. L'utilisateur peut ainsi modifier
 * chiffre/deadline/canal de notification sans repartir de zéro.
 */
export function AlertButton({ title, category, forecastType, threshold, direction }: AlertButtonProps) {
  function openModalToObjective() {
    const team = TEAM_MAP[category] ?? "sales";
    const kpiId = KPI_MAP[forecastType ?? ""] ?? "";

    // Détection unité depuis le titre (heuristique)
    let defaultUnit: "percent" | "currency" | "count" = "count";
    if (/%/.test(title)) defaultUnit = "percent";
    else if (/€|K€|MRR|ARR|\bCA\b/.test(title)) defaultUnit = "currency";

    window.dispatchEvent(
      new CustomEvent("revold:open-alert-modal", {
        detail: {
          team,
          kpiId,
          defaultThreshold: threshold,
          defaultDirection: direction,
          defaultUnit,
          startStep: 3,
        },
      }),
    );
  }

  return (
    <button
      type="button"
      onClick={openModalToObjective}
      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      Modifier cette alerte
    </button>
  );
}
