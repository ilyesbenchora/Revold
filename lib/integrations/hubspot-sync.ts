/**
 * HubSpot Sync Engine
 * Fetches pipeline stages to correctly map won/lost status.
 * Maps lifecycle stages properly for MQL/SQL.
 * Triggers KPI recomputation after deals sync.
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

type SyncResult = { count: number; errors: string[] };

// ── HubSpot Pipeline Stages ──

type StageInfo = { isClosed: boolean; isWon: boolean; isLost: boolean; probability: number };

async function fetchPipelineStages(accessToken: string): Promise<Map<string, StageInfo>> {
  const res = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<string, StageInfo>();

  for (const pipeline of data.results ?? []) {
    for (const stage of pipeline.stages ?? []) {
      const isClosed = stage.metadata?.isClosed === "true";
      const prob = parseFloat(stage.metadata?.probability ?? "0");
      map.set(stage.id, {
        isClosed,
        isWon: isClosed && prob === 1.0,
        isLost: isClosed && prob === 0.0,
        probability: prob * 100,
      });
    }
  }
  return map;
}

// ── Lifecycle stage → MQL/SQL mapping ──
// HubSpot lifecycle stages: subscriber, lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer, evangelist, other
const MQL_STAGES = new Set(["marketingqualifiedlead"]);
const SQL_STAGES = new Set(["salesqualifiedlead", "opportunity", "customer"]);

function isMql(lifecycle: string | null): boolean {
  const lc = lifecycle?.toLowerCase() ?? "";
  return MQL_STAGES.has(lc) || SQL_STAGES.has(lc); // SQL implies MQL
}

function isSql(lifecycle: string | null): boolean {
  const lc = lifecycle?.toLowerCase() ?? "";
  return SQL_STAGES.has(lc);
}

// ── Sync by type ──

let cachedStages: Map<string, StageInfo> | null = null;

export async function syncHubSpotDataByType(
  supabase: SupabaseClient,
  orgId: string,
  accessToken: string,
  syncType: "companies" | "contacts" | "deals",
): Promise<SyncResult> {
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
    // Fetch pipeline stages from HubSpot to correctly identify won/lost
    cachedStages = await fetchPipelineStages(accessToken);
    const data = await fetchHubSpotDeals(accessToken);
    for (let i = 0; i < data.length; i += 50) {
      const batch = data.slice(i, i + 50).map((d) => mapDeal(d, orgId, cachedStages!));
      const { error } = await supabase.from("deals").upsert(batch, { onConflict: "organization_id,hubspot_id" });
      if (error) errors.push(error.message);
      else count += batch.length;
    }
  }

  return { count, errors };
}

// ── KPI Recomputation ──

export async function recomputeKpis(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
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
  return {
    organization_id: orgId,
    hubspot_id: hscont.id,
    email: hscont.properties.email || `unknown-${hscont.id}@hubspot.com`,
    full_name: [hscont.properties.firstname, hscont.properties.lastname].filter(Boolean).join(" ") || `Contact ${hscont.id}`,
    title: hscont.properties.jobtitle,
    phone: hscont.properties.phone,
    is_mql: isMql(hscont.properties.lifecyclestage),
    is_sql: isSql(hscont.properties.lifecyclestage),
  };
}

function mapDeal(hsd: HubSpotDeal, orgId: string, stages: Map<string, StageInfo>) {
  const stageInfo = stages.get(hsd.properties.dealstage);

  return {
    organization_id: orgId,
    hubspot_id: hsd.id,
    name: hsd.properties.dealname || `Deal ${hsd.id}`,
    amount: hsd.properties.amount ? Number(hsd.properties.amount) : 0,
    close_date: hsd.properties.closedate?.split("T")[0] || null,
    created_date: hsd.properties.createdate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    last_activity_at: hsd.properties.hs_lastmodifieddate || null,
    is_closed_won: stageInfo?.isWon ?? false,
    is_closed_lost: stageInfo?.isLost ?? false,
    win_probability: stageInfo?.probability ?? 0,
    updated_at: new Date().toISOString(),
  };
}
