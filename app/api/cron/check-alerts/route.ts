import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveKpiValue, isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { sendNotification, type NotificationChannelType } from "@/lib/notifications/send";

export const maxDuration = 300;

const FORECAST_LABELS: Record<string, string> = {
  closing_rate: "Closing rate",
  conversion_rate: "Taux de conversion Lead→Opp",
  pipeline_coverage: "Suivi pipeline",
  orphan_rate: "Taux d'orphelins",
  deal_activation: "Activation des deals",
  phone_enrichment: "Enrichissement téléphone",
  pipeline_value: "Pipeline en valeur",
  dormant_reactivation: "Réactivation contacts dormants",
};

const FORECAST_UNITS: Record<string, string> = {
  closing_rate: "%",
  conversion_rate: "%",
  pipeline_coverage: "%",
  orphan_rate: "%",
  deal_activation: "%",
  phone_enrichment: "%",
  pipeline_value: "€",
  dormant_reactivation: "contacts",
};

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch all active alerts with a forecast_type
  const { data: activeAlerts, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("status", "active")
    .not("forecast_type", "is", null);

  if (error || !activeAlerts) {
    return NextResponse.json({ error: error?.message ?? "No alerts" }, { status: 500 });
  }

  let resolved = 0;
  let checked = 0;
  let notificationsCreated = 0;

  for (const alert of activeAlerts) {
    // Check expiration
    if (alert.expires_at && new Date(alert.expires_at) < new Date()) {
      await supabase.from("alerts").update({ status: "expired" }).eq("id", alert.id);
      continue;
    }

    const filters = {
      pipeline_id: alert.pipeline_id,
      owner_filter: alert.owner_filter,
      date_from: alert.date_from,
      date_to: alert.date_to,
      date_preset: alert.date_preset,
      segment_filter: alert.segment_filter,
      min_deal_amount: alert.min_deal_amount,
      deal_stage_filter: alert.deal_stage_filter,
      lifecycle_stage: alert.lifecycle_stage,
      source_filters: alert.source_filters,
      custom_property: alert.custom_property,
      custom_prop_value: alert.custom_prop_value,
    };
    const currentValue = await resolveKpiValue(supabase, alert.organization_id, alert.forecast_type, filters);
    if (currentValue === null) continue;

    checked++;

    // Update current_value and last_checked
    await supabase
      .from("alerts")
      .update({
        current_value: currentValue,
        last_checked: new Date().toISOString(),
      })
      .eq("id", alert.id);

    // Check if threshold is met
    const direction = alert.direction || "above";
    if (isThresholdMet(currentValue, alert.threshold, direction)) {
      // Mark alert as resolved
      await supabase
        .from("alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          current_value: currentValue,
        })
        .eq("id", alert.id);

      resolved++;

      // Notification multi-canaux selon la config per-alert
      const unit = FORECAST_UNITS[alert.forecast_type] || "";
      const label = FORECAST_LABELS[alert.forecast_type] || alert.forecast_type;
      const subject = `Objectif atteint : ${label}`;
      const body =
        `Votre objectif de ${alert.threshold}${unit} a été atteint !\n\n` +
        `Valeur actuelle : ${currentValue}${unit}\n` +
        `Direction : ${direction === "above" ? "↑ atteindre" : "↓ descendre sous"} ${alert.threshold}${unit}\n` +
        (alert.description ? `\n${alert.description}\n` : "") +
        `\nOuvrez Revold pour voir tous les détails et configurer la prochaine étape.`;

      // Canaux configurés pour cette alerte (default = ["in_app"])
      const channels = (Array.isArray(alert.notification_channels) && alert.notification_channels.length > 0
        ? alert.notification_channels
        : ["in_app"]) as NotificationChannelType[];

      const result = await sendNotification(supabase, {
        orgId: alert.organization_id,
        sourceType: "alert_resolved",
        sourceId: alert.id,
        channels,
        userId: alert.created_by ?? undefined,
        subject,
        bodyText: body,
        link: "/dashboard/alertes",
      });

      if (result.sentCount > 0) notificationsCreated++;
    }
  }

  return NextResponse.json({
    checked,
    resolved,
    notificationsCreated,
    total: activeAlerts.length,
  });
}
