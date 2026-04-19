export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncHubSpotDataByType, recomputeKpis } from "@/lib/integrations/hubspot-sync";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const syncType = url.searchParams.get("type") as "companies" | "contacts" | "deals" | "kpi" | null;
  const requestedOrgId = url.searchParams.get("orgId");

  // ── Auth ──
  // Accepte 2 modes :
  //  1. orgId explicite via query + CRON_SECRET (utilisé par le callback OAuth
  //     en fire-and-forget, et par les crons multi-tenant)
  //  2. Pas d'orgId → fallback sur la 1ère org (legacy single-tenant)
  let orgId: string;
  if (requestedOrgId) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    orgId = requestedOrgId;
  } else {
    const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }
    orgId = orgs[0].id;
  }

  // Token OAuth de cette org spécifique (multi-tenant safe)
  const accessToken = await getHubSpotToken(supabase, orgId);
  if (!accessToken) {
    return NextResponse.json({ error: "Aucun token HubSpot — connectez via OAuth" }, { status: 400 });
  }

  try {
    if (syncType === "kpi") {
      const kpiResult = await recomputeKpis(supabase, orgId);
      return NextResponse.json({ type: "kpi", orgId, ...kpiResult });
    }

    const type = syncType || "companies";

    // Marque le sync comme "running" dans metadata (visible côté UI)
    await markSyncStatus(orgId, "running", { syncing_type: type });

    const { count, errors } = await syncHubSpotDataByType(supabase, orgId, accessToken, type);

    await supabase.from("sync_logs").insert({
      organization_id: orgId,
      source: "hubspot",
      direction: "inbound",
      entity_type: type,
      status: errors.length > 0 ? "partial" : "completed",
      entity_count: count,
      error_message: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
    });

    await supabase
      .from("integrations")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("provider", "hubspot");

    let kpiResult = null;
    if (type === "deals") {
      kpiResult = await recomputeKpis(supabase, orgId);
      await markSyncStatus(orgId, "completed");
    }

    // Chaînage automatique : companies → contacts → deals (en background)
    const next = type === "companies" ? "contacts" : type === "contacts" ? "deals" : "done";
    if (next !== "done") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const cronSecret = process.env.CRON_SECRET || "";
      if (cronSecret) {
        fetch(`${appUrl}/api/integrations/hubspot/sync?orgId=${orgId}&type=${next}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cronSecret}` },
          signal: AbortSignal.timeout(1000),
        }).catch(() => {
          // Timeout attendu (continuera côté Vercel)
        });
      }
    }

    return NextResponse.json({ type, orgId, count, errors, kpiComputed: kpiResult, next });
  } catch (err) {
    await markSyncStatus(orgId, "failed", { error: String(err).slice(0, 200) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

/**
 * Met à jour le statut du sync initial dans integrations.metadata.
 * Permet à l'UI d'afficher "Synchronisation en cours..." sans nouvelle table.
 */
async function markSyncStatus(
  orgId: string,
  status: "running" | "completed" | "failed",
  extra: Record<string, string> = {},
): Promise<void> {
  const { data: row } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .single();

  const meta = (row?.metadata ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const newMeta: Record<string, unknown> = { ...meta, initial_sync_status: status, ...extra };
  if (status === "running" && !meta.initial_sync_started_at) {
    newMeta.initial_sync_started_at = now;
  }
  if (status === "completed" || status === "failed") {
    newMeta.initial_sync_completed_at = now;
  }

  await supabase
    .from("integrations")
    .update({ metadata: newMeta, updated_at: now })
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");
}
