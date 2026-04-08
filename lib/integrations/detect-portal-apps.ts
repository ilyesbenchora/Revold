/**
 * Detect HubSpot apps installed on the portal — both public marketplace apps
 * and private apps. Uses HubSpot's Account Info API which exposes API usage
 * grouped by integration name.
 *
 * - /account-info/v3/api-usage/daily/private-apps → private apps + usage
 * - /account-info/v3/api-usage/daily → every integration that called the API
 *   (private + public + HubSpot native), grouped by name
 */

const HS_API = "https://api.hubapi.com";

export type PortalApp = {
  name: string;
  type: "private" | "public";
  // Total API calls observed today (or last available day)
  usageCount: number;
};

type DailyUsageRow = {
  name?: string;
  appId?: number;
  usageCount?: number;
  collectionName?: string;
};

async function fetchPrivateApps(token: string): Promise<PortalApp[]> {
  try {
    const res = await fetch(`${HS_API}/account-info/v3/api-usage/daily/private-apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: DailyUsageRow[] = data.results ?? data ?? [];
    // Aggregate per app name (the endpoint returns one row per day, keep latest)
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const name = r.name || r.collectionName || `Private app ${r.appId ?? ""}`.trim();
      if (!name) return;
      map.set(name, Math.max(map.get(name) ?? 0, r.usageCount ?? 0));
    });
    return Array.from(map.entries()).map(([name, usageCount]) => ({
      name,
      type: "private" as const,
      usageCount,
    }));
  } catch {
    return [];
  }
}

async function fetchAllConsumers(token: string): Promise<Array<{ name: string; usageCount: number }>> {
  try {
    const res = await fetch(`${HS_API}/account-info/v3/api-usage/daily`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: DailyUsageRow[] = data.results ?? data ?? [];
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const name = r.name || r.collectionName;
      if (!name) return;
      map.set(name, Math.max(map.get(name) ?? 0, r.usageCount ?? 0));
    });
    return Array.from(map.entries()).map(([name, usageCount]) => ({ name, usageCount }));
  } catch {
    return [];
  }
}

// Names that should be filtered out as HubSpot-internal (not real "apps")
const HUBSPOT_NATIVE = /^(hubspot|crm|forms?|workflows?|engagement|marketing email|sales|lists|reporting|email|integration platform)/i;

export async function detectPortalApps(token: string): Promise<{
  privateApps: PortalApp[];
  publicApps: PortalApp[];
  totalApps: number;
}> {
  const [privateApps, allConsumers] = await Promise.all([
    fetchPrivateApps(token),
    fetchAllConsumers(token),
  ]);

  const privateNames = new Set(privateApps.map((a) => a.name));

  // Public apps = consumers that are not private and not HubSpot native
  const publicApps: PortalApp[] = allConsumers
    .filter((c) => !privateNames.has(c.name) && !HUBSPOT_NATIVE.test(c.name))
    .map((c) => ({ name: c.name, type: "public", usageCount: c.usageCount }));

  return {
    privateApps: privateApps.sort((a, b) => b.usageCount - a.usageCount),
    publicApps: publicApps.sort((a, b) => b.usageCount - a.usageCount),
    totalApps: privateApps.length + publicApps.length,
  };
}
