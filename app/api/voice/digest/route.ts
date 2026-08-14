import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";

export const dynamic = "force-dynamic";

/**
 * Brief de la tour de contrôle vocale (orbe de la home) — 100 % DÉTERMINISTE
 * (aucun LLM : fiable, instantané, gratuit) :
 *  - alertes actives en tension (seuil atteint sur la dernière valeur connue) ;
 *  - objectifs qui décrochent (< 60 % de progression à ≤ 30 j de l'échéance) ;
 *  - synchronisations en échec (dernier run par outil) ;
 *  - prochains RDV de coaching (≤ 48 h).
 * `?mode=veille` : exceptions uniquement (alertes critiques + syncs en échec).
 * Renvoie aussi le STATUT de santé qui teinte l'anneau de l'orbe.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Tour de contrôle vocale : réservée aux plans Growth et Scale.
  const plan = await getOrgPlan(supabase, orgId);
  if (featureLocked(plan, "voice_control_tower")) {
    return NextResponse.json({ error: "La tour de contrôle vocale est disponible à partir du plan Growth." }, { status: 403 });
  }

  const veille = new URL(request.url).searchParams.get("mode") === "veille";
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString().slice(0, 10);
  const in30d = new Date(now.getTime() + 30 * 86400 * 1000).toISOString().slice(0, 10);

  const [alertsRes, objectivesRes, syncRes, agendaRes] = await Promise.all([
    supabase
      .from("alerts")
      .select("title, severity, threshold, direction, current_value")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(200),
    supabase
      .from("objectives")
      .select("title, target, current_value, direction, date_to")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(100),
    supabase
      .from("sync_logs")
      .select("source, status, started_at")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(60),
    supabase
      .from("coaching_agendas")
      .select("category, next_meeting_at, next_meeting_time")
      .eq("organization_id", orgId)
      .not("next_meeting_at", "is", null),
  ]);

  // ── Alertes en tension : seuil atteint sur la dernière valeur connue ──
  type AlertRow = { title: string; severity: string | null; threshold: number | null; direction: string | null; current_value: number | null };
  const alerts = (alertsRes.data ?? []) as AlertRow[];
  const tense = alerts.filter(
    (a) => a.threshold != null && a.current_value != null && isThresholdMet(a.current_value, a.threshold, a.direction ?? "above"),
  );
  const tenseCritical = tense.filter((a) => a.severity === "critical");

  // ── Objectifs qui décrochent ──
  type ObjRow = { title: string; target: number | null; current_value: number | null; direction: string | null; date_to: string | null };
  const objectives = (objectivesRes.data ?? []) as ObjRow[];
  const offTrack = objectives.filter((o) => {
    if (o.target == null || o.current_value == null || o.target === 0) return false;
    const pct = (o.direction === "below" ? (o.current_value > 0 ? o.target / o.current_value : 1) : o.current_value / o.target) * 100;
    const deadlineSoon = !!o.date_to && o.date_to <= in30d;
    return pct < 60 && deadlineSoon;
  });

  // ── Syncs en échec : dernier run par outil ──
  type SyncRow = { source: string; status: string; started_at: string | null };
  const lastBySource = new Map<string, SyncRow>();
  for (const s of (syncRes.data ?? []) as SyncRow[]) {
    if (!lastBySource.has(s.source)) lastBySource.set(s.source, s);
  }
  const failedSyncs = [...lastBySource.values()].filter((s) => s.status === "failed");

  // ── RDV de coaching à venir (≤ 48 h) ──
  type AgendaRow = { category: string; next_meeting_at: string | null; next_meeting_time?: string | null };
  const CAT_LABEL: Record<string, string> = { commercial: "ventes", marketing: "marketing", data: "data", "data-model": "finance" };
  const meetings = ((agendaRes.data ?? []) as AgendaRow[]).filter(
    (a) => a.next_meeting_at && a.next_meeting_at >= now.toISOString().slice(0, 10) && a.next_meeting_at <= in48h,
  );

  // ── Statut de santé (teinte l'anneau de l'orbe) ──
  const status: "ok" | "warn" | "critical" =
    tenseCritical.length > 0 || failedSyncs.length > 0 ? "critical" : tense.length > 0 || offTrack.length > 0 ? "warn" : "ok";

  // ── Texte du brief, prêt à lire à voix haute ──
  const parts: string[] = [];
  if (tense.length > 0) {
    const names = tense.slice(0, 3).map((a) => a.title).join(", ");
    parts.push(`${tense.length} alerte${tense.length > 1 ? "s" : ""} en tension${tenseCritical.length > 0 ? ` dont ${tenseCritical.length} critique${tenseCritical.length > 1 ? "s" : ""}` : ""} : ${names}.`);
  }
  if (failedSyncs.length > 0) {
    parts.push(`Synchronisation en échec : ${failedSyncs.map((s) => s.source).join(", ")} — à relancer depuis les intégrations.`);
  }
  if (!veille) {
    if (offTrack.length > 0) {
      parts.push(`${offTrack.length} objectif${offTrack.length > 1 ? "s" : ""} en retard à moins de 30 jours de l'échéance : ${offTrack.slice(0, 2).map((o) => o.title).join(", ")}.`);
    }
    if (meetings.length > 0) {
      parts.push(
        `À l'agenda : ${meetings.map((m) => `séance ${CAT_LABEL[m.category] ?? m.category} le ${m.next_meeting_at}${m.next_meeting_time ? ` à ${m.next_meeting_time}` : ""}`).join(", ")}.`,
      );
    }
    if (parts.length === 0) parts.push("Rien à signaler : alertes au vert, objectifs en ligne, synchronisations OK.");
  } else if (parts.length === 0) {
    parts.push("Mode veille : aucune exception — tout est au vert.");
  }

  return NextResponse.json({
    status,
    text: parts.join(" "),
    counts: {
      tenseAlerts: tense.length,
      criticalAlerts: tenseCritical.length,
      offTrackObjectives: offTrack.length,
      failedSyncs: failedSyncs.length,
      upcomingMeetings: meetings.length,
    },
  });
}
