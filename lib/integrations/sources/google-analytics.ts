import { type AdMetrics, emptyMetrics } from "./ads-common";

const PERIOD = "30 derniers jours";

/**
 * Trafic web GA4 (30j) : sessions (impressions), utilisateurs, conversions.
 * Auto-découvre la 1re propriété GA4 accessible. On mappe sur AdMetrics :
 * impressions = sessions, clicks = utilisateurs actifs, conversions = conversions.
 */
export async function fetchGoogleAnalyticsMetrics(accessToken: string): Promise<AdMetrics> {
  try {
    // 1) Découvre une propriété GA4.
    const admRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!admRes.ok) return emptyMetrics("google_analytics", "Google Analytics", PERIOD, `Admin API ${admRes.status}`);
    const admJson = (await admRes.json()) as {
      accountSummaries?: { propertySummaries?: { property: string; displayName: string }[] }[];
    };
    const prop = admJson.accountSummaries?.flatMap((a) => a.propertySummaries ?? [])[0];
    if (!prop?.property) return emptyMetrics("google_analytics", "Google Analytics", PERIOD, "Aucune propriété GA4");
    const propertyId = prop.property.replace("properties/", "");

    // 2) runReport 30 jours.
    const repRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
      }),
    });
    if (!repRes.ok) return emptyMetrics("google_analytics", "Google Analytics", PERIOD, `Data API ${repRes.status}`);
    const rep = (await repRes.json()) as { rows?: { metricValues: { value: string }[] }[] };
    const m = rep.rows?.[0]?.metricValues ?? [];

    return {
      provider: "google_analytics",
      providerLabel: "Google Analytics",
      account: prop.displayName,
      currency: null,
      spend: 0,
      impressions: Number(m[0]?.value ?? 0), // sessions
      clicks: Number(m[1]?.value ?? 0), // utilisateurs actifs
      conversions: Number(m[2]?.value ?? 0),
      period: PERIOD,
    };
  } catch (err) {
    return emptyMetrics("google_analytics", "Google Analytics", PERIOD, err instanceof Error ? err.message.slice(0, 120) : "Erreur");
  }
}
