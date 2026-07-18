import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveKpiValue, isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { sendNotification, type NotificationChannelType } from "@/lib/notifications/send";
import { composeNotification } from "@/lib/notifications/compose";
import { valueFromAggSpec, type AggSpec } from "@/lib/alerts/agg-value";
import { computeReconciledMetric } from "@/lib/reconciliation/engine";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

export const maxDuration = 300;

// Couverture minimale de jointure pour se fier à une recette réconciliée.
const MIN_RECON_COVERAGE = 0.3;

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

  // Alertes actives trackables : KPI catalogué (forecast_type) OU spec d'agrégat
  // (alerte technique/table). Fallback si la colonne agg_spec n'est pas migrée.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeAlerts: any[] | null = null;
  {
    const combined = await supabase
      .from("alerts")
      .select("*")
      .eq("status", "active")
      .or("forecast_type.not.is.null,agg_spec.not.is.null,recon_spec.not.is.null");
    if (combined.error && /(agg_spec|recon_spec)/.test(combined.error.message)) {
      const legacy = await supabase.from("alerts").select("*").eq("status", "active").not("forecast_type", "is", null);
      if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      activeAlerts = legacy.data;
    } else if (combined.error) {
      return NextResponse.json({ error: combined.error.message }, { status: 500 });
    } else {
      activeAlerts = combined.data;
    }
  }
  if (!activeAlerts) return NextResponse.json({ error: "No alerts" }, { status: 500 });

  let resolved = 0;
  let checked = 0;
  let notificationsCreated = 0;

  for (const alert of activeAlerts) {
    // Check expiration
    if (alert.expires_at && new Date(alert.expires_at) < new Date()) {
      await supabase.from("alerts").update({ status: "expired" }).eq("id", alert.id);
      continue;
    }

    // Valeur RÉELLE : KPI catalogué (resolveKpiValue) OU agrégat de table (agg_spec).
    let currentValue: number | null = null;
    if (alert.forecast_type) {
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
      currentValue = await resolveKpiValue(supabase, alert.organization_id, alert.forecast_type, filters);
    } else if (alert.agg_spec) {
      const token = await getHubSpotToken(supabase, alert.organization_id);
      currentValue = await valueFromAggSpec(supabase, alert.organization_id, token, alert.agg_spec as AggSpec);
    } else if (alert.recon_spec?.recipe) {
      const r = await computeReconciledMetric(supabase, alert.organization_id, alert.recon_spec.recipe);
      // Gate de fiabilité : jointure trop peu couverte → on ne se fie pas (pas de faux déclenchement).
      if (!r || !r.hasData || r.coverage < MIN_RECON_COVERAGE) {
        if (r) await supabase.from("alerts").update({ current_value: r.value, last_checked: new Date().toISOString() }).eq("id", alert.id);
        continue;
      }
      currentValue = r.value;
    }
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

      // L'AGENT responsable rédige la notification (l'app a détecté l'atteinte).
      const composed = await composeNotification({
        kind: "alerte",
        team: alert.team ?? null,
        category: alert.category ?? null,
        title: alert.title ?? FORECAST_LABELS[alert.forecast_type] ?? "KPI",
        description: alert.description ?? null,
        userContext: alert.user_context ?? null,
        threshold: alert.threshold ?? null,
        currentValue,
        unit: alert.unit_mode ?? (alert.forecast_type && FORECAST_UNITS[alert.forecast_type] === "%" ? "percent" : "count"),
        direction,
      });

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
        subject: composed.subject,
        bodyText: composed.body,
        link: "/dashboard/mes-alertes",
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
