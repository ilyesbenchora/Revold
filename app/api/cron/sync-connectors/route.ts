/**
 * Cron : synchronisation automatique des connecteurs DIRECTS (Stripe,
 * Pennylane, Chargebee, …) pour toutes les orgs — le pendant de l'ETL HubSpot.
 *
 * Tourne toutes les heures. Pour chaque org × outil connecté :
 *   1. fréquence de la catégorie lue dans sync_config (Paramètres → Modèle de
 *      données) — c'est la source de vérité, plus un réglage décoratif ;
 *   2. dernière sync réussie lue dans sync_logs ;
 *   3. si l'intervalle est écoulé → le connecteur tourne et logge sync_logs.
 *
 * Tolérant : un échec sur un couple org × provider n'arrête pas les autres.
 * Sécurité : header Authorization Bearer CRON_SECRET (pattern etl-delta).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SYNC_REGISTRY, getConnector } from "@/lib/integrations/sync/registry";
import { fail } from "@/lib/integrations/sync/types";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev local
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Fréquence configurée → intervalle minimal entre deux syncs (ms). */
const FREQUENCY_MS: Record<string, number> = {
  realtime: 60 * 60 * 1000,   // pas de vrai temps réel sans webhooks → horaire
  webhooks: 60 * 60 * 1000,   // en attendant les webhooks entrants → horaire
  hourly: 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "2xdaily": 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // sans config : quotidien

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const start = Date.now();
  const supabase = adminClient();

  // Tous les couples org × provider directs actifs (HubSpot a son ETL dédié).
  const { data: integrations } = await supabase
    .from("integrations")
    .select("organization_id, provider, access_token, metadata")
    .eq("is_active", true)
    .neq("provider", "hubspot");

  const candidates = ((integrations ?? []) as Array<{
    organization_id: string;
    provider: string;
    access_token: string | null;
    metadata: Record<string, string> | null;
  }>).filter((i) => i.provider in SYNC_REGISTRY && i.access_token);

  const perRun: Array<{ orgId: string; provider: string; status: string; durationMs?: number }> = [];
  let ran = 0;
  let skipped = 0;
  let failed = 0;

  for (const integ of candidates) {
    const { organization_id: orgId, provider } = integ;
    try {
      // 1. Fréquence de la catégorie de l'outil pour cette org
      const category = CONNECTABLE_TOOLS[provider]?.category ?? "billing";
      const { data: cfg } = await supabase
        .from("sync_config")
        .select("frequency")
        .eq("organization_id", orgId)
        .eq("category", category)
        .maybeSingle();
      const frequency = (cfg?.frequency as string | undefined) ?? "";
      if (frequency === "manual") {
        skipped++;
        perRun.push({ orgId, provider, status: "manual" });
        continue;
      }
      const intervalMs = FREQUENCY_MS[frequency] ?? DEFAULT_INTERVAL_MS;

      // 2. Dernière sync réussie
      const { data: lastLog } = await supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("organization_id", orgId)
        .eq("source", provider)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastAt = lastLog?.completed_at ? new Date(lastLog.completed_at as string).getTime() : 0;
      if (Date.now() - lastAt < intervalMs) {
        skipped++;
        perRun.push({ orgId, provider, status: "fresh" });
        continue;
      }

      // 3. Sync
      const connector = getConnector(provider)!;
      const runStart = Date.now();
      const startedAt = new Date().toISOString();
      let result;
      try {
        result = await connector({
          supabase,
          orgId,
          provider,
          primaryToken: integ.access_token!,
          credentials: integ.metadata ?? {},
        });
      } catch (err) {
        result = fail((err as Error).message);
      }
      await supabase.from("sync_logs").insert({
        organization_id: orgId,
        source: provider,
        direction: "inbound",
        entity_type: provider,
        status: result.notImplemented ? "pending" : result.ok ? "completed" : "failed",
        entity_count: result.total,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        error_message: result.ok ? null : result.message,
      });
      if (result.ok) ran++;
      else failed++;
      perRun.push({ orgId, provider, status: result.ok ? "synced" : "failed", durationMs: Date.now() - runStart });
    } catch (err) {
      failed++;
      perRun.push({ orgId, provider, status: `error: ${(err as Error).message.slice(0, 120)}` });
    }
  }

  return NextResponse.json({
    durationMs: Date.now() - start,
    candidates: candidates.length,
    ran,
    skipped,
    failed,
    perRun,
  });
}
