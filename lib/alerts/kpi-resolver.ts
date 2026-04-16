import { SupabaseClient } from "@supabase/supabase-js";

export type AlertFilters = {
  pipeline_id?: string | null;
  owner_filter?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  date_preset?: string | null;
  segment_filter?: string | null;
  min_deal_amount?: number | null;
  deal_stage_filter?: string | null;
  lifecycle_stage?: string | null;
  source_filters?: string[] | null;
  custom_property?: string | null;
  custom_prop_value?: string | null;
};

function resolveDateRange(filters: AlertFilters): { from: string | null; to: string | null } {
  if (filters.date_from || filters.date_to) {
    return { from: filters.date_from || null, to: filters.date_to || null };
  }
  if (!filters.date_preset) return { from: null, to: null };

  const now = new Date();
  const to = now.toISOString();
  let from: string;

  switch (filters.date_preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1).toISOString();
      break;
    }
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1).toISOString();
      break;
    case "last_30d":
      from = new Date(Date.now() - 30 * 86400000).toISOString();
      break;
    case "last_90d":
      from = new Date(Date.now() - 90 * 86400000).toISOString();
      break;
    default:
      return { from: null, to: null };
  }
  return { from, to };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDealFilters(query: any, filters: AlertFilters) {
  const { from, to } = resolveDateRange(filters);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (filters.pipeline_id) query = query.eq("stage_id", filters.pipeline_id);
  if (filters.owner_filter) query = query.eq("owner_id", filters.owner_filter);
  if (filters.min_deal_amount) query = query.gte("amount", filters.min_deal_amount);
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyContactFilters(query: any, filters: AlertFilters) {
  const { from, to } = resolveDateRange(filters);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (filters.owner_filter) query = query.eq("owner_id", filters.owner_filter);
  return query;
}

/**
 * Source-tracking KPIs query HubSpot directly because hs_analytics_source
 * and lifecyclestage are HubSpot properties not stored in Supabase.
 */
async function queryHubSpotContacts(
  token: string,
  filters: AlertFilters,
  extraFilters: Array<{ propertyName: string; operator: string; value?: string }> = [],
): Promise<number> {
  const allFilters = [...extraFilters];

  if (filters.lifecycle_stage) {
    allFilters.push({ propertyName: "lifecyclestage", operator: "EQ", value: filters.lifecycle_stage });
  }
  if (filters.source_filters && filters.source_filters.length > 0) {
    // HubSpot Search API doesn't support IN, so use multiple filterGroups for OR
    // For simplicity, we filter the first source (most common use case)
    // For multi-source, we'll run parallel queries
    if (filters.source_filters.length === 1) {
      allFilters.push({ propertyName: "hs_analytics_source", operator: "EQ", value: filters.source_filters[0] });
    }
  }
  if (filters.custom_property && filters.custom_prop_value) {
    allFilters.push({ propertyName: filters.custom_property, operator: "EQ", value: filters.custom_prop_value });
  }

  const body: Record<string, unknown> = {
    filterGroups: allFilters.length > 0
      ? [{ filters: allFilters.map((f) => ({ propertyName: f.propertyName, operator: f.operator, ...(f.value != null ? { value: f.value } : {}) })) }]
      : [],
    limit: 1,
  };

  // Handle multi-source: run one query per source, sum results
  if (filters.source_filters && filters.source_filters.length > 1) {
    let total = 0;
    for (const src of filters.source_filters) {
      const srcFilters = allFilters.filter((f) => f.propertyName !== "hs_analytics_source");
      srcFilters.push({ propertyName: "hs_analytics_source", operator: "EQ", value: src });
      const srcBody = {
        filterGroups: [{ filters: srcFilters.map((f) => ({ propertyName: f.propertyName, operator: f.operator, ...(f.value != null ? { value: f.value } : {}) })) }],
        limit: 1,
      };
      try {
        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(srcBody),
        });
        if (res.ok) {
          const data = await res.json();
          total += data.total ?? 0;
        }
      } catch {}
    }
    return total;
  }

  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return data.total ?? 0;
    }
  } catch {}
  return 0;
}

/**
 * Computes the current value of a KPI for a given organization with optional filters.
 */
export async function resolveKpiValue(
  supabase: SupabaseClient,
  orgId: string,
  forecastType: string,
  filters: AlertFilters = {},
): Promise<number | null> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  switch (forecastType) {
    // ── Deal KPIs ──
    case "closing_rate": {
      let qWon = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true);
      let qClosed = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).or("is_closed_won.eq.true,is_closed_lost.eq.true");
      qWon = applyDealFilters(qWon, filters);
      qClosed = applyDealFilters(qClosed, filters);
      const [{ count: won }, { count: closed }] = await Promise.all([qWon, qClosed]);
      if (!closed || closed === 0) return 0;
      return Math.round(((won ?? 0) / closed) * 100);
    }

    case "pipeline_coverage": {
      let qTotal = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false);
      let qNoAct = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null);
      qTotal = applyDealFilters(qTotal, filters);
      qNoAct = applyDealFilters(qNoAct, filters);
      const [{ count: total }, { count: noActivity }] = await Promise.all([qTotal, qNoAct]);
      if (!total || total === 0) return 0;
      return Math.round(((total - (noActivity ?? 0)) / total) * 100);
    }

    case "deal_activation": {
      let qOpen = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false);
      let qNoAct = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).eq("sales_activities_count", 0);
      qOpen = applyDealFilters(qOpen, filters);
      qNoAct = applyDealFilters(qNoAct, filters);
      const [{ count: open }, { count: noActivity }] = await Promise.all([qOpen, qNoAct]);
      if (!open || open === 0) return 0;
      return Math.round(((open - (noActivity ?? 0)) / open) * 100);
    }

    case "pipeline_value": {
      let q = supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).gt("amount", 0);
      q = applyDealFilters(q, filters);
      const { data } = await q;
      return (data ?? []).reduce((sum, d) => sum + (d.amount ?? 0), 0);
    }

    case "avg_deal_size": {
      let q = supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", true).gt("amount", 0);
      q = applyDealFilters(q, filters);
      const { data } = await q;
      if (!data || data.length === 0) return 0;
      return Math.round(data.reduce((s, d) => s + (d.amount ?? 0), 0) / data.length);
    }

    case "deals_at_risk": {
      let q = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_at_risk", true);
      q = applyDealFilters(q, filters);
      const { count } = await q;
      return count ?? 0;
    }

    case "revenue_won": {
      let q = supabase.from("deals").select("amount").eq("organization_id", orgId).eq("is_closed_won", true);
      q = applyDealFilters(q, filters);
      const { data } = await q;
      return (data ?? []).reduce((s, d) => s + (d.amount ?? 0), 0);
    }

    case "deals_count": {
      let q = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId);
      q = applyDealFilters(q, filters);
      const { count } = await q;
      return count ?? 0;
    }

    case "deals_won_count": {
      let q = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", true);
      q = applyDealFilters(q, filters);
      const { count } = await q;
      return count ?? 0;
    }

    case "stagnant_deals": {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      let q = supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).is("next_activity_date", null).lt("last_contacted_at", sevenDaysAgo);
      q = applyDealFilters(q, filters);
      const { count } = await q;
      return count ?? 0;
    }

    // ── Contact KPIs (Supabase) ──
    case "conversion_rate": {
      let qC = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId);
      let qO = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true);
      qC = applyContactFilters(qC, filters);
      qO = applyContactFilters(qO, filters);
      const [{ count: contacts }, { count: opps }] = await Promise.all([qC, qO]);
      if (!contacts || contacts === 0) return 0;
      return Math.round(((opps ?? 0) / contacts) * 100);
    }

    case "orphan_rate": {
      let qC = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId);
      let qO = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null);
      qC = applyContactFilters(qC, filters);
      qO = applyContactFilters(qO, filters);
      const [{ count: contacts }, { count: orphans }] = await Promise.all([qC, qO]);
      if (!contacts || contacts === 0) return 0;
      return Math.round(((orphans ?? 0) / contacts) * 100);
    }

    case "phone_enrichment": {
      let qC = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId);
      let qNP = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("phone", null);
      qC = applyContactFilters(qC, filters);
      qNP = applyContactFilters(qNP, filters);
      const [{ count: contacts }, { count: noPhone }] = await Promise.all([qC, qNP]);
      if (!contacts || contacts === 0) return 0;
      return Math.round(((contacts - (noPhone ?? 0)) / contacts) * 100);
    }

    case "dormant_reactivation": {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
      const { count } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .lt("last_contacted_at", sixMonthsAgo)
        .not("last_contacted_at", "is", null);
      return count ?? 0;
    }

    // ── Source tracking KPIs (HubSpot API) ──
    case "contacts_by_source": {
      if (!token) return 0;
      return await queryHubSpotContacts(token, filters);
    }

    case "source_to_lead_rate": {
      if (!token) return 0;
      const [total, leads] = await Promise.all([
        queryHubSpotContacts(token, filters),
        queryHubSpotContacts(token, filters, [{ propertyName: "lifecyclestage", operator: "EQ", value: "lead" }]),
      ]);
      if (total === 0) return 0;
      return Math.round((leads / total) * 100);
    }

    case "source_to_mql_rate": {
      if (!token) return 0;
      const [total, mqls] = await Promise.all([
        queryHubSpotContacts(token, filters),
        queryHubSpotContacts(token, filters, [{ propertyName: "lifecyclestage", operator: "EQ", value: "marketingqualifiedlead" }]),
      ]);
      if (total === 0) return 0;
      return Math.round((mqls / total) * 100);
    }

    case "source_to_sql_rate": {
      if (!token) return 0;
      const [total, sqls] = await Promise.all([
        queryHubSpotContacts(token, filters),
        queryHubSpotContacts(token, filters, [{ propertyName: "lifecyclestage", operator: "EQ", value: "salesqualifiedlead" }]),
      ]);
      if (total === 0) return 0;
      return Math.round((sqls / total) * 100);
    }

    case "source_to_opportunity_rate": {
      if (!token) return 0;
      const [total, opps] = await Promise.all([
        queryHubSpotContacts(token, filters),
        queryHubSpotContacts(token, filters, [{ propertyName: "lifecyclestage", operator: "EQ", value: "opportunity" }]),
      ]);
      if (total === 0) return 0;
      return Math.round((opps / total) * 100);
    }

    case "source_to_customer_rate": {
      if (!token) return 0;
      const [total, customers] = await Promise.all([
        queryHubSpotContacts(token, filters),
        queryHubSpotContacts(token, filters, [{ propertyName: "lifecyclestage", operator: "EQ", value: "customer" }]),
      ]);
      if (total === 0) return 0;
      return Math.round((customers / total) * 100);
    }

    default:
      return null;
  }
}

export function getDefaultDirection(forecastType: string): "above" | "below" {
  switch (forecastType) {
    case "orphan_rate":
    case "deals_at_risk":
    case "stagnant_deals":
    case "dormant_reactivation":
      return "below";
    default:
      return "above";
  }
}

export function isThresholdMet(currentValue: number, threshold: number, direction: string): boolean {
  if (direction === "below") return currentValue <= threshold;
  return currentValue >= threshold;
}
