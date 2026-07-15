/** Métriques normalisées d'une régie publicitaire, sur une période. */
export type AdMetrics = {
  provider: string;
  providerLabel: string;
  account: string | null;
  currency: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** Période couverte, ex. "30 derniers jours". */
  period: string;
  error?: string;
};

export function emptyMetrics(provider: string, providerLabel: string, period: string, error?: string): AdMetrics {
  return { provider, providerLabel, account: null, currency: null, spend: 0, impressions: 0, clicks: 0, conversions: 0, period, error };
}
