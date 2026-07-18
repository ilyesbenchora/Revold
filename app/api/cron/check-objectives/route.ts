import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveKpiValue, isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { sendNotification } from "@/lib/notifications/send";
import { composeNotification } from "@/lib/notifications/compose";

export const maxDuration = 300;

/**
 * Suivi des OBJECTIFS sur les vraies données :
 *  - calcule la valeur réelle du KPI auto-tracké (forecast_type) ;
 *  - met à jour current_value + last_checked ;
 *  - à l'atteinte de la cible, l'agent responsable rédige la notification
 *    (une seule fois, via resolved_at).
 * Les objectifs à valeur manuelle (sans forecast_type) sont ignorés : rien à
 * recalculer côté données.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Objectifs actifs, auto-trackés, pas encore atteints. Fallback si les colonnes
  // de suivi ne sont pas migrées.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let objectives: any[] | null = null;
  const primary = await supabase
    .from("objectives")
    .select("*")
    .eq("status", "active")
    .not("forecast_type", "is", null)
    .is("resolved_at", null);
  if (primary.error && /resolved_at/.test(primary.error.message)) {
    const legacy = await supabase.from("objectives").select("*").eq("status", "active").not("forecast_type", "is", null);
    if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 });
    objectives = legacy.data;
  } else if (primary.error) {
    return NextResponse.json({ error: primary.error.message }, { status: 500 });
  } else {
    objectives = primary.data;
  }
  if (!objectives) return NextResponse.json({ error: "No objectives" }, { status: 500 });

  let checked = 0;
  let reached = 0;

  for (const obj of objectives) {
    const forecastType = obj.forecast_type as string | null;
    if (!forecastType) continue;

    const currentValue = await resolveKpiValue(supabase, obj.organization_id as string, forecastType, {
      date_from: (obj.date_from as string | null) ?? null,
      date_to: (obj.date_to as string | null) ?? null,
    });
    if (currentValue === null) continue;
    checked++;

    await supabase
      .from("objectives")
      .update({ current_value: currentValue, last_checked: new Date().toISOString() })
      .eq("id", obj.id);

    const direction = (obj.direction as string) || "above";
    if (obj.target != null && isThresholdMet(currentValue, Number(obj.target), direction)) {
      await supabase.from("objectives").update({ resolved_at: new Date().toISOString() }).eq("id", obj.id);
      reached++;

      const composed = await composeNotification({
        kind: "objectif",
        team: (obj.team as string | null) ?? (obj.category as string | null) ?? null,
        category: (obj.category as string | null) ?? null,
        title: (obj.title as string) || "Objectif",
        description: (obj.description as string | null) ?? null,
        userContext: (obj.impact as string | null) ?? null,
        threshold: obj.target != null ? Number(obj.target) : null,
        currentValue,
        unit: (obj.unit_mode as string) || "count",
        direction,
      });

      await sendNotification(supabase, {
        orgId: obj.organization_id as string,
        sourceType: "manual",
        sourceId: obj.id as string,
        channels: ["in_app"],
        userId: (obj.created_by as string | null) ?? undefined,
        subject: composed.subject,
        bodyText: composed.body,
        link: "/dashboard/mes-alertes/objectifs",
      });
    }
  }

  return NextResponse.json({ checked, reached, total: objectives.length });
}
