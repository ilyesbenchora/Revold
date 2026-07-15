import { type AdMetrics, emptyMetrics } from "./ads-common";

const API = "https://googleads.googleapis.com/v18";
const PERIOD = "30 derniers jours";

/**
 * Google Ads (30j) : coût, impressions, clics, conversions du 1er compte
 * accessible. Nécessite un developer token (GOOGLE_ADS_DEVELOPER_TOKEN).
 */
export async function fetchGoogleAdsMetrics(accessToken: string): Promise<AdMetrics> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) return emptyMetrics("google_ads", "Google Ads", PERIOD, "GOOGLE_ADS_DEVELOPER_TOKEN manquant");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };

  try {
    // 1) Comptes accessibles.
    const listRes = await fetch(`${API}/customers:listAccessibleCustomers`, { headers });
    if (!listRes.ok) return emptyMetrics("google_ads", "Google Ads", PERIOD, `List ${listRes.status}`);
    const listJson = (await listRes.json()) as { resourceNames?: string[] };
    const first = listJson.resourceNames?.[0]; // "customers/1234567890"
    if (!first) return emptyMetrics("google_ads", "Google Ads", PERIOD, "Aucun compte accessible");
    const customerId = first.replace("customers/", "");

    // 2) GAQL sur 30 jours.
    const query =
      "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, customer.currency_code, customer.descriptive_name FROM customer WHERE segments.date DURING LAST_30_DAYS";
    const repRes = await fetch(`${API}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    if (!repRes.ok) return emptyMetrics("google_ads", "Google Ads", PERIOD, `Search ${repRes.status}`);
    const rep = (await repRes.json()) as {
      results?: {
        metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number };
        customer?: { currencyCode?: string; descriptiveName?: string };
      }[];
    };
    let spend = 0, impressions = 0, clicks = 0, conversions = 0;
    let currency: string | null = null;
    let account: string | null = null;
    for (const r of rep.results ?? []) {
      spend += Number(r.metrics?.costMicros ?? 0) / 1e6;
      impressions += Number(r.metrics?.impressions ?? 0);
      clicks += Number(r.metrics?.clicks ?? 0);
      conversions += Number(r.metrics?.conversions ?? 0);
      currency = r.customer?.currencyCode ?? currency;
      account = r.customer?.descriptiveName ?? account;
    }
    return { provider: "google_ads", providerLabel: "Google Ads", account, currency, spend, impressions, clicks, conversions, period: PERIOD };
  } catch (err) {
    return emptyMetrics("google_ads", "Google Ads", PERIOD, err instanceof Error ? err.message.slice(0, 120) : "Erreur");
  }
}
