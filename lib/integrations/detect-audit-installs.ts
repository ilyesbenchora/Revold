/**
 * Detect HubSpot integration installs via the Audit Logs API.
 *
 * This is the most reliable detection path: every app install/uninstall
 * fires an event in /audit-logs/v3/logs. By replaying these events we
 * reconstruct the exact list of apps installed on the portal, including
 * the install date and the user who installed them.
 *
 * ⚠️  Endpoint requires the **Enterprise** HubSpot plan. On Pro/Starter
 *     it returns 403 — we degrade silently to an empty array so the rest
 *     of the detection pipeline continues to run unaffected.
 *
 * This module is dormant on Pro plans but kept in the codebase ready to
 * activate the moment a customer upgrades to Enterprise.
 */

const HS_API = "https://api.hubapi.com";

export type AuditInstall = {
  appName: string;
  installedAt?: string;
  installedByUserId?: string;
  uninstalledAt?: string;
};

type AuditLogRow = {
  objectId?: string;
  objectType?: string;
  eventType?: string;
  action?: string;
  occurredAt?: string;
  performedBy?: { userId?: string; email?: string };
  metadata?: Record<string, unknown>;
};

/**
 * Pull audit log events related to integration install / uninstall and
 * return the resulting "currently installed" set.
 */
export async function detectAuditInstalls(token: string): Promise<AuditInstall[]> {
  // We try several known shapes of the audit logs endpoint. HubSpot has
  // shipped slightly different versions over the years; we accept whichever
  // responds 200.
  const candidatePaths = [
    `/audit-logs/v3/logs?objectType=INTEGRATION&limit=200`,
    `/audit-logs/v3/logs?objectTypeId=INTEGRATION&limit=200`,
    `/audit-log/v3/logs?objectType=INTEGRATION&limit=200`,
  ];

  let rows: AuditLogRow[] = [];
  for (const path of candidatePaths) {
    try {
      const res = await fetch(`${HS_API}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      // 403 = plan limitation, 404 = endpoint shape not supported, 401 = scope missing
      if (res.status === 403 || res.status === 404 || res.status === 401) continue;
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: AuditLogRow[] };
      if (data.results && data.results.length > 0) {
        rows = data.results;
        break;
      }
    } catch {
      // Try the next candidate
    }
  }
  if (rows.length === 0) return [];

  // Replay install/uninstall events into a map keyed by app name
  const apps = new Map<string, AuditInstall>();
  for (const row of rows) {
    const appName =
      ((row.metadata as Record<string, unknown> | undefined)?.appName as string) ||
      ((row.metadata as Record<string, unknown> | undefined)?.name as string) ||
      row.objectId ||
      "";
    if (!appName) continue;
    const eventType = (row.eventType || row.action || "").toUpperCase();
    const isInstall = eventType.includes("INSTALL") && !eventType.includes("UNINSTALL");
    const isUninstall = eventType.includes("UNINSTALL");

    const existing = apps.get(appName) ?? { appName };
    if (isInstall) {
      existing.installedAt = row.occurredAt ?? existing.installedAt;
      existing.installedByUserId = row.performedBy?.userId ?? existing.installedByUserId;
    }
    if (isUninstall) {
      existing.uninstalledAt = row.occurredAt ?? existing.uninstalledAt;
    }
    apps.set(appName, existing);
  }

  // Keep only currently-installed apps (last install is more recent than last uninstall)
  return Array.from(apps.values()).filter((a) => {
    if (!a.installedAt) return false;
    if (!a.uninstalledAt) return true;
    return new Date(a.installedAt).getTime() > new Date(a.uninstalledAt).getTime();
  });
}
