/**
 * Catalogue des plans Revold (Stripe billing).
 *
 * Source de vérité pour :
 *   - le contenu de la page /tarifs
 *   - le mapping plan → features (paywall)
 *   - le mapping plan → Stripe Price ID (env vars)
 *
 * Note : les Price IDs réels sont dans .env.local (côté server uniquement) :
 *   STRIPE_PRICE_ID_STARTER_MONTHLY / _STARTER_YEARLY
 *   STRIPE_PRICE_ID_GROWTH_MONTHLY  / _GROWTH_YEARLY
 *   STRIPE_PRICE_ID_SCALE_MONTHLY   / _SCALE_YEARLY
 */

export type PlanKey = "starter" | "growth" | "scale";
export type BillingPeriod = "monthly" | "yearly";

export type FeatureKey =
  | "weekly_pulse"
  | "metrics_essential"
  | "metrics_full"
  | "ai_diagnostic"
  | "ai_recommendations"
  | "deal_risk_detection"
  | "anomaly_detection"
  | "quarterly_reports"
  | "what_if_simulations"
  | "deal_coaching_advanced"
  | "advisor_revops"
  | "api_webhooks"
  | "unlimited_connectors"
  | "sla";

export type Plan = {
  key: PlanKey;
  name: string;
  monthlyPrice: number; // EUR HT
  yearlyPrice: number;  // EUR HT (= 10 mois ≈ -17%)
  description: string;
  features: FeatureKey[];
  /** Limite hard sur le nombre de connecteurs CRM/billing actifs. */
  maxConnectors: number | null;
  /** Plan recommandé visuellement sur la page tarifs. */
  featured: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter",
    name: "Starter",
    monthlyPrice: 79,
    yearlyPrice: 790,
    description: "Pour les équipes qui démarrent leur journey RevOps",
    features: ["weekly_pulse", "metrics_essential"],
    maxConnectors: 1,
    featured: false,
  },
  growth: {
    key: "growth",
    name: "Growth",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    description: "Pour les équipes qui veulent scaler intelligemment",
    features: [
      "weekly_pulse",
      "metrics_essential",
      "metrics_full",
      "ai_diagnostic",
      "ai_recommendations",
      "deal_risk_detection",
      "anomaly_detection",
    ],
    maxConnectors: 3,
    featured: true,
  },
  scale: {
    key: "scale",
    name: "Scale",
    monthlyPrice: 699,
    yearlyPrice: 6990,
    description: "Pour les revenue teams ambitieuses",
    features: [
      "weekly_pulse",
      "metrics_essential",
      "metrics_full",
      "ai_diagnostic",
      "ai_recommendations",
      "deal_risk_detection",
      "anomaly_detection",
      "quarterly_reports",
      "what_if_simulations",
      "deal_coaching_advanced",
      "advisor_revops",
      "api_webhooks",
      "unlimited_connectors",
      "sla",
    ],
    maxConnectors: null,
    featured: false,
  },
};

export const TRIAL_DAYS = 14;

/** Durée du trial en secondes (utilisé par Stripe trial_period_days converti). */
export const TRIAL_PERIOD_DAYS = TRIAL_DAYS;

/** Convertit un plan + période vers la variable d'environnement Stripe Price ID. */
export function getStripePriceId(
  plan: PlanKey,
  period: BillingPeriod,
): string | null {
  const envKey = `STRIPE_PRICE_ID_${plan.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[envKey] ?? null;
}

/** Inverse : à partir d'un Stripe Price ID retourne le plan + période matching. */
export function planFromPriceId(
  priceId: string,
): { plan: PlanKey; period: BillingPeriod } | null {
  for (const plan of ["starter", "growth", "scale"] as PlanKey[]) {
    for (const period of ["monthly", "yearly"] as BillingPeriod[]) {
      if (getStripePriceId(plan, period) === priceId) {
        return { plan, period };
      }
    }
  }
  return null;
}

/**
 * Vérifie qu'un plan a accès à une feature donnée (paywall).
 * Pendant le trial (status="trialing"), on accorde toutes les features du plan choisi.
 * Statuts non-actifs (canceled, past_due > 14j) → no access.
 */
export function planHasFeature(
  plan: PlanKey | null | undefined,
  feature: FeatureKey,
): boolean {
  if (!plan) return false;
  return PLANS[plan].features.includes(feature);
}
