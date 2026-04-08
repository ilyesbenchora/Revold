/**
 * Detect HubSpot apps installed on the portal — both public marketplace apps
 * and private apps. Tries several HubSpot endpoints in order of completeness:
 *
 *   1. /integrators-public/v1/portals/{portalId}/connected-applications
 *      ↳ The endpoint behind the Settings → Connected Apps UI page. Returns
 *        every installed app (active OR inactive) with name, install date,
 *        last activity. Undocumented but stable for portal-owner tokens.
 *   2. /integration-platform/v1/installs (alternate spelling sometimes used)
 *   3. /account-info/v3/api-usage/daily/private-apps  → private apps
 *   4. /account-info/v3/api-usage/daily               → all daily consumers
 *
 * Results from all endpoints are merged and deduplicated by app name so we
 * surface the most complete picture possible.
 */

const HS_API = "https://api.hubapi.com";

export type PortalApp = {
  name: string;
  type: "private" | "public";
  /** Total API calls observed (or 0 if surfaced only via the install list). */
  usageCount: number;
  /** When the app was installed on the portal (if known). */
  installedAt?: string;
  /** Last time the app was active (if known). */
  lastActivityAt?: string;
};

type ApiUsageRow = {
  name?: string;
  appId?: number;
  usageCount?: number;
  collectionName?: string;
};

type IntegratorsAppRow = {
  appId?: number;
  appName?: string;
  name?: string;
  installedAt?: string;
  installDate?: string;
  lastActivityAt?: string;
  lastUsedAt?: string;
  status?: string;
  type?: string;
};

async function fetchPortalId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${HS_API}/account-info/v3/details`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return String(data.portalId ?? data.hubId ?? data.id ?? "") || null;
  } catch {
    return null;
  }
}

/**
 * Try the undocumented endpoint behind HubSpot's "Connected Apps" UI page.
 * Returns the full list of installed applications regardless of activity.
 */
async function fetchInstalledAppsViaIntegrators(
  token: string,
  portalId: string,
): Promise<PortalApp[]> {
  const candidatePaths = [
    `/integrators-public/v1/portals/${portalId}/connected-applications`,
    `/integrators/v1/${portalId}/installed/apps`,
    `/integration-platform/v1/portals/${portalId}/installs`,
    `/marketplace/v2/installs?portalId=${portalId}`,
  ];

  for (const path of candidatePaths) {
    try {
      const res = await fetch(`${HS_API}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      const rows: IntegratorsAppRow[] =
        (data.results as IntegratorsAppRow[] | undefined) ??
        (data.installs as IntegratorsAppRow[] | undefined) ??
        (data.applications as IntegratorsAppRow[] | undefined) ??
        (data.connectedApps as IntegratorsAppRow[] | undefined) ??
        (Array.isArray(data) ? (data as unknown as IntegratorsAppRow[]) : []);
      if (!rows || rows.length === 0) continue;
      return rows
        .map((r) => ({
          name: r.appName || r.name || `App ${r.appId ?? ""}`.trim(),
          type:
            (r.type || "").toLowerCase().includes("private")
              ? ("private" as const)
              : ("public" as const),
          usageCount: 0,
          installedAt: r.installedAt || r.installDate,
          lastActivityAt: r.lastActivityAt || r.lastUsedAt,
        }))
        .filter((a) => a.name);
    } catch {
      // Try the next candidate path
    }
  }
  return [];
}

async function fetchPrivateAppsDaily(token: string): Promise<PortalApp[]> {
  try {
    const res = await fetch(`${HS_API}/account-info/v3/api-usage/daily/private-apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: ApiUsageRow[] = data.results ?? data ?? [];
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

async function fetchAllConsumersDaily(
  token: string,
): Promise<Array<{ name: string; usageCount: number }>> {
  try {
    const res = await fetch(`${HS_API}/account-info/v3/api-usage/daily`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: ApiUsageRow[] = data.results ?? data ?? [];
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
  // 1. Try to get portal id (needed for the integrators endpoints)
  const portalId = await fetchPortalId(token);

  // 2. Run all detection paths in parallel
  const [installedViaUi, privateDaily, allConsumersDaily] = await Promise.all([
    portalId ? fetchInstalledAppsViaIntegrators(token, portalId) : Promise.resolve([]),
    fetchPrivateAppsDaily(token),
    fetchAllConsumersDaily(token),
  ]);

  // 3. Merge by name. Priority: integrators (most complete) > daily endpoints
  const merged = new Map<string, PortalApp>();

  installedViaUi.forEach((a) => {
    if (HUBSPOT_NATIVE.test(a.name)) return;
    merged.set(a.name, a);
  });

  privateDaily.forEach((a) => {
    if (HUBSPOT_NATIVE.test(a.name)) return;
    const existing = merged.get(a.name);
    if (existing) {
      existing.usageCount = Math.max(existing.usageCount, a.usageCount);
    } else {
      merged.set(a.name, a);
    }
  });

  const privateNames = new Set(
    Array.from(merged.values())
      .filter((a) => a.type === "private")
      .map((a) => a.name),
  );

  allConsumersDaily.forEach((c) => {
    if (HUBSPOT_NATIVE.test(c.name)) return;
    const existing = merged.get(c.name);
    if (existing) {
      existing.usageCount = Math.max(existing.usageCount, c.usageCount);
    } else {
      merged.set(c.name, {
        name: c.name,
        type: privateNames.has(c.name) ? "private" : "public",
        usageCount: c.usageCount,
      });
    }
  });

  const all = Array.from(merged.values());
  const privateApps = all
    .filter((a) => a.type === "private")
    .sort((a, b) => b.usageCount - a.usageCount);
  const publicApps = all
    .filter((a) => a.type === "public")
    .sort((a, b) => b.usageCount - a.usageCount);

  return {
    privateApps,
    publicApps,
    totalApps: privateApps.length + publicApps.length,
  };
}
