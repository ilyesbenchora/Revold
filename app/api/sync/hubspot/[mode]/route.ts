/**
 * Sync HubSpot → Supabase ETL.
 *
 * Modes :
 *   - full     : ré-importe TOUS les objets (bootstrap initial ou hebdo)
 *   - delta    : ne ré-importe que les records modifiés depuis le watermark
 *   - snapshot : recalcule juste le snapshot KPI depuis la donnée locale
 *
 * Flow complet (full ou delta) :
 *   1. Auth (orgId + token HubSpot)
 *   2. syncAllForOrg(token, supabase, orgId, mode)
 *      → contacts, companies, deals, tickets (CRM Search API)
 *      → pipelines, owners, workflows, forms, lists, marketing campaigns,
 *        events, goals, leads, invoices, subscriptions, quotes, line_items
 *   3. computeSnapshotFromLocal(supabase, orgId)
 *   4. persistSnapshotCache(supabase, orgId, snapshot)
 *
 * Tolérant aux pannes : chaque object_type est wrappé en try/catch dans
 * l'ETL, donc une 401/404/429 sur un type n'arrête pas le run global.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { syncAllForOrg, type SyncResult } from "@/lib/sync/hubspot-etl";
import { computeSnapshotFromLocal, persistSnapshotCache } from "@/lib/sync/compute-snapshot";

type Mode = "full" | "delta" | "snapshot";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ mode: string }> },
) {
  const start = Date.now();
  const { mode: rawMode } = await context.params;
  const mode = (["full", "delta", "snapshot"].includes(rawMode) ? rawMode : "delta") as Mode;

  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "no org" }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return NextResponse.json({ error: "HubSpot non connecté" }, { status: 400 });
  }

  let syncResults: SyncResult[] = [];
  if (mode !== "snapshot") {
    try {
      syncResults = await syncAllForOrg(token, supabase, orgId, mode as "full" | "delta");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur ETL";
      return NextResponse.json(
        { error: message, durationMs: Date.now() - start },
        { status: 500 },
      );
    }
  }

  // Recalcule + persiste le snapshot KPI
  let snapshotPersisted = false;
  let snapshotError: string | null = null;
  try {
    const snap = await computeSnapshotFromLocal(supabase, orgId);
    await persistSnapshotCache(
      supabase,
      orgId,
      snap,
      mode === "full" ? "bootstrap" : "sync",
    );
    snapshotPersisted = true;
  } catch (err) {
    snapshotError = err instanceof Error ? err.message : "Erreur snapshot";
  }

  const okCount = syncResults.filter((r) => r.ok).length;
  const failCount = syncResults.length - okCount;
  const upsertedTotal = syncResults.reduce((s, r) => s + r.upserted, 0);

  return NextResponse.json({
    mode,
    durationMs: Date.now() - start,
    objects: {
      ok: okCount,
      failed: failCount,
      total: syncResults.length,
      upserted: upsertedTotal,
    },
    results: syncResults,
    snapshot: {
      persisted: snapshotPersisted,
      error: snapshotError,
    },
  });
}
