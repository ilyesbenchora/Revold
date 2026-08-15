import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Santé des crons — lit cron_runs (alimentée par monitoredCron) et signale :
 *  - le dernier run de chaque cron (statut, durée, erreur) ;
 *  - les crons EN RETARD : pas de succès depuis > 2× leur cadence attendue
 *    (un cron qui ne tourne plus = données périmées en silence).
 * Accès : utilisateur authentifié, ou Bearer CRON_SECRET (monitoring externe).
 */

// Cadence attendue (minutes) — alignée sur vercel.json.
const EXPECTED_INTERVAL_MIN: Record<string, number> = {
  "etl-delta": 30,
  "etl-full": 7 * 24 * 60,
  "sync-connectors": 60,
  "check-alerts": 6 * 60,
  "check-objectives": 6 * 60,
  "compute-fill-rates": 6 * 60,
  "daily-digest": 24 * 60,
  "run-routines": 15,
};

export async function GET(request: Request) {
  // Auth : session utilisateur OU secret de cron (uptime monitor externe).
  const authHeader = request.headers.get("authorization");
  const bySecret = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!bySecret) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await admin
    .from("cron_runs")
    .select("cron, status, started_at, finished_at, duration_ms, error")
    .order("started_at", { ascending: false })
    .limit(400);
  if (error) {
    return NextResponse.json({ unavailable: true, hint: "Migration cron_runs non appliquée." });
  }

  type Run = { cron: string; status: string; started_at: string; finished_at: string | null; duration_ms: number | null; error: string | null };
  const runs = (data ?? []) as Run[];
  const lastByCron = new Map<string, Run>();
  const lastOkByCron = new Map<string, Run>();
  for (const r of runs) {
    if (!lastByCron.has(r.cron)) lastByCron.set(r.cron, r);
    if (r.status === "ok" && !lastOkByCron.has(r.cron)) lastOkByCron.set(r.cron, r);
  }

  const now = Date.now();
  const crons = Object.entries(EXPECTED_INTERVAL_MIN).map(([name, intervalMin]) => {
    const last = lastByCron.get(name) ?? null;
    const lastOk = lastOkByCron.get(name) ?? null;
    const lastOkAgoMin = lastOk ? Math.round((now - Date.parse(lastOk.started_at)) / 60000) : null;
    // stale = jamais tourné avec succès depuis > 2× la cadence (ou jamais,
    // dès lors qu'au moins UN cron a déjà écrit — sinon table toute neuve).
    const stale = lastOkAgoMin === null ? runs.length > 0 : lastOkAgoMin > intervalMin * 2;
    return {
      cron: name,
      expectedEveryMin: intervalMin,
      lastStatus: last?.status ?? null,
      lastRunAt: last?.started_at ?? null,
      lastDurationMs: last?.duration_ms ?? null,
      lastError: last?.status === "failed" ? last?.error ?? null : null,
      lastSuccessAt: lastOk?.started_at ?? null,
      stale,
    };
  });

  const failing = crons.filter((c) => c.lastStatus === "failed").map((c) => c.cron);
  const staleList = crons.filter((c) => c.stale).map((c) => c.cron);
  return NextResponse.json({
    healthy: failing.length === 0 && staleList.length === 0,
    failing,
    stale: staleList,
    crons,
  });
}
