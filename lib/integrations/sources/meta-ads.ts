import { type AdMetrics, emptyMetrics } from "./ads-common";

const GRAPH = "https://graph.facebook.com/v21.0";
const PERIOD = "30 derniers jours";

/** Récupère les insights Meta Ads (30j) du 1er ad account accessible. */
export async function fetchMetaAdsMetrics(accessToken: string): Promise<AdMetrics> {
  try {
    // 1) Découvre l'ad account.
    const accRes = await fetch(`${GRAPH}/me/adaccounts?fields=account_id,name,currency&limit=1&access_token=${accessToken}`);
    if (!accRes.ok) return emptyMetrics("meta_ads", "Meta Ads", PERIOD, `API ${accRes.status}`);
    const accJson = (await accRes.json()) as { data?: { id: string; account_id: string; name: string; currency: string }[] };
    const acc = accJson.data?.[0];
    if (!acc) return emptyMetrics("meta_ads", "Meta Ads", PERIOD, "Aucun compte publicitaire accessible");

    // 2) Insights sur 30 jours.
    const insRes = await fetch(
      `${GRAPH}/${acc.id}/insights?date_preset=last_30d&fields=spend,impressions,clicks,actions&access_token=${accessToken}`,
    );
    if (!insRes.ok) return emptyMetrics("meta_ads", "Meta Ads", PERIOD, `Insights ${insRes.status}`);
    const insJson = (await insRes.json()) as {
      data?: { spend?: string; impressions?: string; clicks?: string; actions?: { action_type: string; value: string }[] }[];
    };
    const row = insJson.data?.[0];
    const conversions =
      row?.actions
        ?.filter((a) => /purchase|lead|complete_registration|offsite_conversion/i.test(a.action_type))
        .reduce((s, a) => s + Number(a.value || 0), 0) ?? 0;

    return {
      provider: "meta_ads",
      providerLabel: "Meta Ads",
      account: acc.name,
      currency: acc.currency ?? null,
      spend: Number(row?.spend ?? 0),
      impressions: Number(row?.impressions ?? 0),
      clicks: Number(row?.clicks ?? 0),
      conversions,
      period: PERIOD,
    };
  } catch (err) {
    return emptyMetrics("meta_ads", "Meta Ads", PERIOD, err instanceof Error ? err.message.slice(0, 120) : "Erreur");
  }
}
