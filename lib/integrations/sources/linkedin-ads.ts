import { type AdMetrics, emptyMetrics } from "./ads-common";

const API = "https://api.linkedin.com/rest";
const VERSION = "202405";
const PERIOD = "30 derniers jours";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/** LinkedIn Ads (30j) : dépense, impressions, clics, conversions du 1er compte. */
export async function fetchLinkedInAdsMetrics(token: string): Promise<AdMetrics> {
  try {
    // 1) Découvre un ad account.
    const accRes = await fetch(`${API}/adAccounts?q=search&start=0&count=1`, { headers: headers(token) });
    if (!accRes.ok) return emptyMetrics("linkedin_ads", "LinkedIn Ads", PERIOD, `Accounts ${accRes.status}`);
    const accJson = (await accRes.json()) as { elements?: { id: number; name?: string; currency?: string }[] };
    const acc = accJson.elements?.[0];
    if (!acc) return emptyMetrics("linkedin_ads", "LinkedIn Ads", PERIOD, "Aucun compte publicitaire");

    // 2) Analytics 30 jours (pivot ACCOUNT).
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400_000);
    const dr = `dateRange=(start:(year:${start.getFullYear()},month:${start.getMonth() + 1},day:${start.getDate()}),end:(year:${end.getFullYear()},month:${end.getMonth() + 1},day:${end.getDate()}))`;
    const account = encodeURIComponent(`urn:li:sponsoredAccount:${acc.id}`);
    const fields = "costInLocalCurrency,impressions,clicks,externalWebsiteConversions";
    const q = `q=analytics&pivot=ACCOUNT&timeGranularity=ALL&${dr}&accounts=List(${account})&fields=${fields}`;
    const anRes = await fetch(`${API}/adAnalytics?${q}`, { headers: headers(token) });
    if (!anRes.ok) return emptyMetrics("linkedin_ads", "LinkedIn Ads", PERIOD, `Analytics ${anRes.status}`);
    const an = (await anRes.json()) as {
      elements?: { costInLocalCurrency?: string; impressions?: number; clicks?: number; externalWebsiteConversions?: number }[];
    };
    const row = an.elements?.[0];

    return {
      provider: "linkedin_ads",
      providerLabel: "LinkedIn Ads",
      account: acc.name ?? `Account ${acc.id}`,
      currency: acc.currency ?? null,
      spend: Number(row?.costInLocalCurrency ?? 0),
      impressions: Number(row?.impressions ?? 0),
      clicks: Number(row?.clicks ?? 0),
      conversions: Number(row?.externalWebsiteConversions ?? 0),
      period: PERIOD,
    };
  } catch (err) {
    return emptyMetrics("linkedin_ads", "LinkedIn Ads", PERIOD, err instanceof Error ? err.message.slice(0, 120) : "Erreur");
  }
}
