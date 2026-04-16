import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Computes the current value of a KPI for a given organization.
 * Each forecast_type maps to a real query against CRM data.
 */
export async function resolveKpiValue(
  supabase: SupabaseClient,
  orgId: string,
  forecastType: string,
): Promise<number | null> {
  switch (forecastType) {
    case "closing_rate": {
      const [{ count: won }, { count: closed }] = await Promise.all([
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).or("is_closed_won.eq.true,is_closed_lost.eq.true"),
      ]);
      if (!closed || closed === 0) return 0;
      return Math.round(((won ?? 0) / closed) * 100);
    }

    case "conversion_rate": {
      const [{ count: contacts }, { count: opps }] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
      ]);
      if (!contacts || contacts === 0) return 0;
      return Math.round(((opps ?? 0) / contacts) * 100);
    }

    case "pipeline_coverage": {
      const [{ count: total }, { count: noActivity }] = await Promise.all([
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null),
      ]);
      if (!total || total === 0) return 0;
      return Math.round(((total - (noActivity ?? 0)) / total) * 100);
    }

    case "orphan_rate": {
      const [{ count: contacts }, { count: orphans }] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
      ]);
      if (!contacts || contacts === 0) return 0;
      return Math.round(((orphans ?? 0) / contacts) * 100);
    }

    case "deal_activation": {
      const [{ count: open }, { count: noActivity }] = await Promise.all([
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0),
      ]);
      if (!open || open === 0) return 0;
      return Math.round((((open - (noActivity ?? 0)) / open) * 100));
    }

    case "phone_enrichment": {
      const [{ count: contacts }, { count: noPhone }] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("phone", null),
      ]);
      if (!contacts || contacts === 0) return 0;
      return Math.round((((contacts - (noPhone ?? 0)) / contacts) * 100));
    }

    case "pipeline_value": {
      const { data } = await supabase
        .from("deals")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("is_closed_won", false)
        .eq("is_closed_lost", false)
        .gt("amount", 0);
      return (data ?? []).reduce((sum, d) => sum + (d.amount ?? 0), 0);
    }

    case "dormant_reactivation": {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .lt("last_contacted_at", sixMonthsAgo)
        .not("last_contacted_at", "is", null);
      return count ?? 0;
    }

    default:
      return null;
  }
}

/**
 * Determines the default direction for a forecast type.
 * "above" = alert when value >= threshold (e.g., closing rate reaching 35%)
 * "below" = alert when value <= threshold (e.g., orphan rate dropping to 10%)
 */
export function getDefaultDirection(forecastType: string): "above" | "below" {
  switch (forecastType) {
    case "orphan_rate":
      return "below";
    default:
      return "above";
  }
}

/**
 * Check if threshold is met based on direction.
 */
export function isThresholdMet(currentValue: number, threshold: number, direction: string): boolean {
  if (direction === "below") {
    return currentValue <= threshold;
  }
  return currentValue >= threshold;
}
