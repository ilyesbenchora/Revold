/**
 * HubSpot Sync Engine
 * Maps HubSpot data to Revold schema, batch upserts, then triggers KPI recomputation.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchHubSpotCompanies,
  fetchHubSpotContacts,
  fetchHubSpotDeals,
  type HubSpotCompany,
  type HubSpotContact,
  type HubSpotDeal,
} from "./hubspot";
import { computeAllKpis } from "@/lib/kpi/compute";

type SyncResult = {
  companies: number;
  contacts: number;
  deals: number;
  kpiComputed: boolean;
  errors: string[];
};

// HubSpot closed-won stage IDs (common defaults + common names)
const CLOSED_WON_STAGES = new Set([
  "closedwon", "closed won", "closed_won",
  "qualifiedtobuy", // HubSpot default won stage
]);
const CLOSED_LOST_STAGES = new Set([
  "closedlost", "closed lost", "closed_lost",
]);

function inferDealStatus(dealstage: string): { is_closed_won: boolean; is_closed_lost: boolean } {
  const stage = dealstage.toLowerCase().replace(/[\s-]/g, "");
  return {
    is_closed_won: CLOSED_WON_STAGES.has(stage) || stage.includes("won") || stage.includes("gagn"),
    is_closed_lost: CLOSED_LOST_STAGES.has(stage) || stage.includes("lost") || stage.includes("perdu"),
  };
}

export async function syncHubSpotDataByType(
  supabase: SupabaseClient,
  orgId: string,
  accessToken: string,
  syncType: "companies" | "contacts" | "deals",
): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];

  if (syncType === "companies") {
    const data = await fetchHubSpotCompanies(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((c) => mapCompany(c, orgId));
      const { error } = await supabase.from("companies").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  } else if (syncType === "contacts") {
    const data = await fetchHubSpotContacts(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((c) => mapContact(c, orgId));
      const { error } = await supabase.from("contacts").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  } else if (syncType === "deals") {
    const data = await fetchHubSpotDeals(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((d) => mapDeal(d, orgId));
      const { error } = await supabase.from("deals").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  }

  return { count, errors };
}

export async function recomputeKpis(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  // Fetch all data needed for KPI computation
  const [dealsRes, contactsRes, activitiesRes, orgRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, amount, close_date, created_date, days_in_stage, last_activity_at, is_at_risk, is_closed_won, is_closed_lost, win_probability")
      .eq("organization_id", orgId),
    supabase
      .from("contacts")
      .select("id, company_id, is_mql, is_sql")
      .eq("organization_id", orgId),
    supabase
      .from("activities")
      .select("id, deal_id")
      .eq("organization_id", orgId),
    supabase
      .from("organizations")
      .select("quarterly_target")
      .eq("id", orgId)
      .single(),
  ]);

  const quarterlyTarget = Number(orgRes.data?.quarterly_target) || 2000000;

  const deals = (dealsRes.data ?? []).map((d) => ({
    id: d.id,
    amount: Number(d.amount) || 0,
    close_date: d.close_date,
    created_date: d.created_date,
    days_in_stage: d.days_in_stage ?? 0,
    last_activity_at: d.last_activity_at,
    is_at_risk: d.is_at_risk ?? false,
    is_closed_won: d.is_closed_won ?? false,
    is_closed_lost: d.is_closed_lost ?? false,
    stage_probability: Number(d.win_probability) || 50,
  }));

  const contacts = contactsRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const previousMqls = contacts.filter((c) => c.is_mql).length;

  const kpis = computeAllKpis(deals, contacts, activities, quarterlyTarget, previousMqls);

  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("kpi_snapshots").upsert(
    { organization_id: orgId, snapshot_date: today, ...kpis },
    { onConflict: "organization_id,snapshot_date" },
  );

  return { success: !error, error: error?.message };
}

// ── Mappers ──

function mapCompany(hsc: HubSpotCompany, orgId: string) {
  return {
    organization_id: orgId,
    hubspot_id: hsc.id,
    name: hsc.properties.name || `Company ${hsc.id}`,
    domain: hsc.properties.domain,
    industry: hsc.properties.industry,
    annual_revenue: hsc.properties.annualrevenue ? Number(hsc.properties.annualrevenue) : null,
    employee_count: hsc.properties.numberofemployees ? Number(hsc.properties.numberofemployees) : null,
    updated_at: new Date().toISOString(),
  };
}

function mapContact(hscont: HubSpotContact, orgId: string) {
  const lifecycle = hscont.properties.lifecyclestage?.toLowerCase() ?? "";
  return {
    organization_id: orgId,
    hubspot_id: hscont.id,
    email: hscont.properties.email || `unknown-${hscont.id}@hubspot.com`,
    full_name: [hscont.properties.firstname, hscont.properties.lastname].filter(Boolean).join(" ") || `Contact ${hscont.id}`,
    title: hscont.properties.jobtitle,
    phone: hscont.properties.phone,
    is_mql: ["marketingqualifiedlead", "mql"].includes(lifecycle) || lifecycle.includes("qualified"),
    is_sql: ["salesqualifiedlead", "sql", "opportunity"].includes(lifecycle),
  };
}

function mapDeal(hsd: HubSpotDeal, orgId: string) {
  const { is_closed_won, is_closed_lost } = inferDealStatus(hsd.properties.dealstage);
  const lastModified = hsd.properties.hs_lastmodifieddate;

  return {
    organization_id: orgId,
    hubspot_id: hsd.id,
    name: hsd.properties.dealname || `Deal ${hsd.id}`,
    amount: hsd.properties.amount ? Number(hsd.properties.amount) : 0,
    close_date: hsd.properties.closedate?.split("T")[0] || null,
    created_date: hsd.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    last_activity_at: lastModified || null,
    is_closed_won,
    is_closed_lost,
    updated_at: new Date().toISOString(),
  };
}
