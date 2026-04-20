/**
 * GET /api/cron/daily-digest
 *
 * Cron quotidien (configuré dans vercel.json à 8h UTC).
 * Pour chaque org ayant un canal email actif :
 *   - Récupère les alertes RÉSOLVED dans les dernières 24h
 *   - Récupère les top 3 coachings critiques générés
 *   - Compose un digest et envoie via les canaux email/slack/teams configurés
 *
 * Auth : CRON_SECRET en Authorization Bearer.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotification, type NotificationChannelType } from "@/lib/notifications/send";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Toutes les orgs ayant au moins un canal de notif activé avec digest_daily
  const { data: orgs } = await supabase
    .from("notification_channels")
    .select("organization_id")
    .eq("enabled", true)
    .eq("digest_daily_enabled", true);

  const uniqueOrgIds = Array.from(new Set((orgs ?? []).map((o) => o.organization_id as string)));

  let digestsSent = 0;
  let totalAlerts = 0;
  let totalCoachings = 0;

  for (const orgId of uniqueOrgIds) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Alertes résolues dans les 24h
    const { data: alerts } = await supabase
      .from("alerts")
      .select("title, threshold, current_value, direction, category, resolved_at")
      .eq("organization_id", orgId)
      .eq("status", "resolved")
      .gte("resolved_at", since);

    // Coachings critiques actifs
    const { data: coachings } = await supabase
      .from("report_coachings")
      .select("title, severity, recommendation")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .eq("severity", "critical")
      .order("created_at", { ascending: false })
      .limit(3);

    // Si rien à reporter, on skip
    const hasContent = (alerts && alerts.length > 0) || (coachings && coachings.length > 0);
    if (!hasContent) continue;

    totalAlerts += alerts?.length ?? 0;
    totalCoachings += coachings?.length ?? 0;

    // Quels canaux d'envoi ?
    const { data: channels } = await supabase
      .from("notification_channels")
      .select("type")
      .eq("organization_id", orgId)
      .eq("enabled", true)
      .eq("digest_daily_enabled", true);

    const channelTypes = (channels ?? [])
      .map((c) => c.type as NotificationChannelType)
      .filter((t) => t !== "in_app"); // digest n'a pas de in_app

    if (channelTypes.length === 0) continue;

    // Compose le digest
    const today = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const subject = `Digest Revold — ${today}`;

    const lines: string[] = [];
    lines.push(`Bonjour,`);
    lines.push(``);
    lines.push(`Voici votre digest quotidien Revold du ${today}.`);
    lines.push(``);

    if (alerts && alerts.length > 0) {
      lines.push(`━━━ OBJECTIFS ATTEINTS (${alerts.length}) ━━━`);
      for (const a of alerts) {
        const arrow = a.direction === "below" ? "↓" : "↑";
        lines.push(`• ${a.title} — ${arrow} ${a.current_value} (objectif ${a.threshold})`);
      }
      lines.push(``);
    }

    if (coachings && coachings.length > 0) {
      lines.push(`━━━ COACHINGS CRITIQUES (${coachings.length}) ━━━`);
      for (const c of coachings) {
        lines.push(`• ${c.title}`);
        if (c.recommendation) lines.push(`  → ${c.recommendation.slice(0, 200)}${c.recommendation.length > 200 ? "..." : ""}`);
      }
      lines.push(``);
    }

    lines.push(`Ouvrez Revold pour explorer le détail et activer les actions recommandées.`);
    const bodyText = lines.join("\n");

    const result = await sendNotification(supabase, {
      orgId,
      sourceType: "daily_digest",
      channels: channelTypes,
      subject,
      bodyText,
      link: "/dashboard",
    });

    if (result.sentCount > 0) digestsSent++;
  }

  return NextResponse.json({
    orgs_processed: uniqueOrgIds.length,
    digests_sent: digestsSent,
    total_alerts: totalAlerts,
    total_coachings: totalCoachings,
  });
}
