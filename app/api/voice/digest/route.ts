import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { computeBillingRadar } from "@/lib/audit/billing-radar";

/** Format lisible à voix haute d'un total de KPI personnalisé. */
function fmtCustomValue(v: number, unit: string | null): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

export const dynamic = "force-dynamic";

/**
 * Brief de la tour de contrôle vocale (orbe de la home) — 100 % DÉTERMINISTE
 * (aucun LLM : fiable, instantané, gratuit) :
 *  - alertes actives en tension (seuil atteint sur la dernière valeur connue) ;
 *  - objectifs qui décrochent (< 60 % de progression à ≤ 30 j de l'échéance) ;
 *  - synchronisations en échec (dernier run par outil) ;
 *  - prochains RDV de coaching (≤ 48 h).
 * `?mode=veille` : exceptions uniquement (alertes critiques + syncs en échec).
 * `?sections=alerts,objectives,syncs,meetings` : contenu personnalisé du brief
 * (Paramètres → Tour de contrôle) — les sections absentes ne sont pas lues.
 * Renvoie aussi le STATUT de santé qui teinte l'anneau de l'orbe (calculé sur
 * TOUTES les données, indépendamment des sections choisies).
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Tour de contrôle vocale : réservée aux plans Business et Scale.
  const plan = await getOrgPlan(supabase, orgId);
  if (featureLocked(plan, "voice_control_tower")) {
    return NextResponse.json({ error: "La tour de contrôle vocale est disponible à partir du plan Business." }, { status: 403 });
  }

  const url = new URL(request.url);
  const veille = url.searchParams.get("mode") === "veille";
  // Sections choisies dans Paramètres → Tour de contrôle (défaut : toutes).
  const sectionsParam = url.searchParams.get("sections");
  const sections = new Set(
    sectionsParam != null ? sectionsParam.split(",").filter(Boolean) : ["alerts", "objectives", "syncs", "meetings"],
  );
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

  // ── Radar de facturation : factures attendues non émises (rythme observé /
  //    fin de contrat CRM) — une exception de trésorerie, lue avec les alertes. ──
  let radarOverdue = 0;
  let radarAmount = 0;
  try {
    const radar = await computeBillingRadar(supabase, orgId, 1000);
    radarOverdue = radar.overdue.length;
    radarAmount = radar.overdueAmount;
  } catch {}

  // ── RDV de coaching à venir (≤ 48 h) ──
  type AgendaRow = { category: string; next_meeting_at: string | null; next_meeting_time?: string | null };
  const CAT_LABEL: Record<string, string> = { commercial: "ventes", marketing: "marketing", data: "data", "data-model": "finance" };
  const meetings = ((agendaRes.data ?? []) as AgendaRow[]).filter(
    (a) => a.next_meeting_at && a.next_meeting_at >= now.toISOString().slice(0, 10) && a.next_meeting_at <= in48h,
  );

  // ── Données personnalisées du brief (KPIs câblés dans Paramètres → Tour de
  //    contrôle) : recalculées EN DIRECT via le même moteur déterministe que
  //    les tables de données. Best-effort : un KPI en erreur est simplement omis.
  type CustomItem = {
    label?: string;
    enabled?: boolean;
    unit?: string | null;
    query?: { entity?: string; groupBy?: string; measure?: string; field?: string | null };
  };
  let customParts: string[] = [];
  try {
    const { data: settingsRow } = await supabase
      .from("voice_tower_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();
    const rawItems = (settingsRow?.settings as { briefCustom?: unknown } | null)?.briefCustom;
    const enabled = (Array.isArray(rawItems) ? (rawItems as CustomItem[]) : [])
      .filter((i) => i?.enabled !== false && i?.label && i?.query?.entity && i?.query?.groupBy && i?.query?.measure)
      .slice(0, 8);
    if (enabled.length > 0) {
      const hubspotToken = await getHubSpotToken(supabase, orgId);
      const computed = await Promise.all(
        enabled.map(async (i) => {
          try {
            const result = await computeAggregate(supabase, orgId, [], hubspotToken, {
              entity: i.query!.entity!,
              groupBy: i.query!.groupBy!,
              measure: i.query!.measure!,
              field: i.query!.field ?? null,
              pipeline: null,
              granularity: null,
              date_from: null,
              date_to: null,
            });
            if (result.error) return null;
            const rows = ((result.rows as { value?: number }[] | undefined) ?? []);
            const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
            return `${i.label} : ${fmtCustomValue(total, i.unit ?? null)}`;
          } catch {
            return null;
          }
        }),
      );
      customParts = computed.filter((p): p is string => p !== null);
    }
  } catch {
    /* réglages absents (migration) ou moteur indisponible → brief sans custom */
  }

  // ── Statut de santé (teinte l'anneau de l'orbe) ──
  const status: "ok" | "warn" | "critical" =
    tenseCritical.length > 0 || failedSyncs.length > 0
      ? "critical"
      : tense.length > 0 || offTrack.length > 0 || radarOverdue > 0
        ? "warn"
        : "ok";

  // ── Texte du brief, prêt à lire à voix haute ──
  const parts: string[] = [];
  if (sections.has("alerts") && tense.length > 0) {
    const names = tense.slice(0, 3).map((a) => a.title).join(", ");
    parts.push(`${tense.length} alerte${tense.length > 1 ? "s" : ""} en tension${tenseCritical.length > 0 ? ` dont ${tenseCritical.length} critique${tenseCritical.length > 1 ? "s" : ""}` : ""} : ${names}.`);
  }
  if (sections.has("alerts") && radarOverdue > 0) {
    parts.push(
      `${radarOverdue} facture${radarOverdue > 1 ? "s" : ""} attendue${radarOverdue > 1 ? "s" : ""} non émise${radarOverdue > 1 ? "s" : ""}${radarAmount > 0 ? ` — environ ${fmtCustomValue(radarAmount, "currency")} à facturer` : ""} : détail sur la page Trésorerie.`,
    );
  }
  if (sections.has("syncs") && failedSyncs.length > 0) {
    parts.push(`Synchronisation en échec : ${failedSyncs.map((s) => s.source).join(", ")} — à relancer depuis les intégrations.`);
  }
  if (!veille) {
    if (sections.has("objectives") && offTrack.length > 0) {
      parts.push(`${offTrack.length} objectif${offTrack.length > 1 ? "s" : ""} en retard à moins de 30 jours de l'échéance : ${offTrack.slice(0, 2).map((o) => o.title).join(", ")}.`);
    }
    if (sections.has("meetings") && meetings.length > 0) {
      parts.push(
        `À l'agenda : ${meetings.map((m) => `séance ${CAT_LABEL[m.category] ?? m.category} le ${m.next_meeting_at}${m.next_meeting_time ? ` à ${m.next_meeting_time}` : ""}`).join(", ")}.`,
      );
    }
    // Données personnalisées : lues à la fin du brief, valeurs en direct.
    if (customParts.length > 0) parts.push(`Tes données personnalisées : ${customParts.join(" ; ")}.`);
    if (parts.length === 0) parts.push("Rien à signaler sur le périmètre de ton brief — tout est au vert.");
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
      customData: customParts.length,
      overdueExpectedInvoices: radarOverdue,
    },
  });
}
