/**
 * Cron : full sync HubSpot pour TOUTES les orgs (1× par semaine, dimanche 3h).
 *
 * Lance une réconciliation complète : full re-import de chaque object_type
 * (sans watermark) → garantit la parité 100 % avec HubSpot une fois par
 * semaine (filet de sécurité contre les drifts résiduels).
 *
 * Sécurité identique à etl-delta (CRON_SECRET).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncAllForOrg } from "@/lib/sync/hubspot-etl";
import { computeSnapshotFromLocal, persistSnapshotCache } from "@/lib/sync/compute-snapshot";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const start = Date.now();
  const supabase = adminClient();

  const { data: orgs } = await supabase
    .from("integrations")
    .select("organization_id")
    .eq("provider", "hubspot")
    .eq("is_active", true);

  const uniqueOrgs = Array.from(new Set((orgs ?? []).map((o) => o.organization_id as string)));

  let processed = 0;
  let failed = 0;
  const perOrg: Array<{ orgId: string; ok: boolean; upserted: number; durationMs: number; error?: string }> = [];

  for (const orgId of uniqueOrgs) {
    const orgStart = Date.now();
    try {
      const token = await getHubSpotToken(supabase, orgId);
      if (!token) {
        failed++;
        perOrg.push({ orgId, ok: false, upserted: 0, durationMs: 0, error: "no token" });
        continue;
      }
      const results = await syncAllForOrg(token, supabase, orgId, "full");
      const upserted = results.reduce((s, r) => s + r.upserted, 0);

      const snap = await computeSnapshotFromLocal(supabase, orgId);
      await persistSnapshotCache(supabase, orgId, snap, "bootstrap");

      processed++;
      perOrg.push({ orgId, ok: true, upserted, durationMs: Date.now() - orgStart });
    } catch (err) {
      failed++;
      perOrg.push({
        orgId,
        ok: false,
        upserted: 0,
        durationMs: Date.now() - orgStart,
        error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      });
    }
  }

  return NextResponse.json({
    mode: "full",
    durationMs: Date.now() - start,
    orgs: { total: uniqueOrgs.length, processed, failed },
    perOrg,
  });
}
