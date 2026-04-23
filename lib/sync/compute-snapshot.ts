/**
 * Calcule le HubSpotSnapshot complet UNIQUEMENT depuis les données locales
 * Supabase. Aucun appel HubSpot.
 *
 * Cette fonction tourne après chaque sync (delta ou full) et écrit dans
 * hubspot_snapshot_cache. L'UI Revold lit ce cache via getCachedSnapshot()
 * — donc latence ~50 ms et zéro 429.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HubSpotSnapshot } from "@/lib/integrations/hubspot-snapshot";
import { EMPTY_SNAPSHOT } from "@/lib/integrations/hubspot-snapshot";

type DealRow = {
  raw_data: Record<string, unknown>;
  amount: number | null;
  is_closed_won: boolean | null;
  is_closed_lost: boolean | null;
  pipeline_external_id: string | null;
  stage_external_id: string | null;
  close_date: string | null;
  hs_last_modified_at: string | null;
};

type ContactRow = {
  raw_data: Record<string, unknown>;
};

type CompanyRow = {
  raw_data: Record<string, unknown>;
  industry: string | null;
  domain: string | null;
  annual_revenue: number | null;
};

function rawProp(raw: Record<string, unknown>, key: string): string | null {
  const props = (raw?.properties as Record<string, string | null>) ?? {};
  return props[key] ?? null;
}

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  orgId: string,
  select: string,
): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("organization_id", orgId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as unknown as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function computeSnapshotFromLocal(
  supabase: SupabaseClient,
  orgId: string,
): Promise<HubSpotSnapshot> {
  const snap: HubSpotSnapshot = { ...EMPTY_SNAPSHOT };

  // ── Deals ────────────────────────────────────────────────────────────
  const deals = await fetchAll<DealRow>(
    supabase,
    "deals",
    orgId,
    "raw_data, amount, is_closed_won, is_closed_lost, pipeline_external_id, stage_external_id, close_date, hs_last_modified_at",
  );
  snap.totalDeals = deals.length;
  const isClosed = (d: DealRow) => Boolean(d.is_closed_won) || Boolean(d.is_closed_lost);
  snap.wonDeals = deals.filter((d) => Boolean(d.is_closed_won)).length;
  snap.lostDeals = deals.filter((d) => Boolean(d.is_closed_lost)).length;
  snap.openDeals = deals.filter((d) => !isClosed(d)).length;
  const closedTotal = snap.wonDeals + snap.lostDeals;
  snap.closingRate = closedTotal > 0 ? Math.round((snap.wonDeals / closedTotal) * 100) : 0;

  snap.wonAmount = deals.filter((d) => Boolean(d.is_closed_won)).reduce((s, d) => s + (d.amount ?? 0), 0);
  snap.totalPipelineAmount = deals
    .filter((d) => !isClosed(d))
    .reduce((s, d) => s + (d.amount ?? 0), 0);
  snap.dealsNoAmount = deals.filter((d) => !isClosed(d) && (!d.amount || d.amount === 0)).length;
  snap.dealsNoCloseDate = deals.filter((d) => !isClosed(d) && !d.close_date).length;

  snap.dealsNoNextActivity = deals.filter(
    (d) => !isClosed(d) && !rawProp(d.raw_data, "notes_next_activity_date"),
  ).length;

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  snap.stagnantDeals = deals.filter((d) => {
    if (isClosed(d)) return false;
    const lc = rawProp(d.raw_data, "notes_last_contacted");
    if (!lc) return true;
    const ts = /^\d+$/.test(lc) ? parseInt(lc, 10) : new Date(lc).getTime();
    return ts < sevenDaysAgo;
  }).length;
  snap.dealsAtRisk = snap.stagnantDeals;

  // ── Contacts ─────────────────────────────────────────────────────────
  const contacts = await fetchAll<ContactRow>(supabase, "contacts", orgId, "raw_data");
  snap.totalContacts = contacts.length;

  const lifecycleStats: Record<string, { value: string; label: string; count: number }> = {};
  let leads = 0, opps = 0, customers = 0, orphans = 0;
  let noPhone = 0, noTitle = 0, noEmail = 0;
  for (const c of contacts) {
    const lc = rawProp(c.raw_data, "lifecyclestage") ?? "unknown";
    if (!lifecycleStats[lc]) lifecycleStats[lc] = { value: lc, label: lc, count: 0 };
    lifecycleStats[lc].count += 1;
    if (["lead", "marketingqualifiedlead", "salesqualifiedlead", "subscriber"].includes(lc)) leads++;
    else if (["opportunity"].includes(lc)) opps++;
    else if (["customer", "evangelist"].includes(lc)) customers++;
    if (!rawProp(c.raw_data, "associatedcompanyid")) orphans++;
    if (!rawProp(c.raw_data, "phone")) noPhone++;
    if (!rawProp(c.raw_data, "jobtitle")) noTitle++;
    if (!rawProp(c.raw_data, "email")) noEmail++;
  }
  snap.leadsCount = leads;
  snap.opportunitiesCount = opps;
  snap.customersCount = customers;
  snap.conversionRate = snap.totalContacts > 0 ? Math.round((opps / snap.totalContacts) * 100) : 0;
  snap.orphansCount = orphans;
  snap.orphanRate = snap.totalContacts > 0 ? Math.round((orphans / snap.totalContacts) * 100) : 0;
  snap.contactsNoPhone = noPhone;
  snap.contactsNoTitle = noTitle;
  snap.contactsNoEmail = noEmail;
  snap.lifecycleByStage = lifecycleStats;

  // ── Companies ────────────────────────────────────────────────────────
  const companies = await fetchAll<CompanyRow>(
    supabase,
    "companies",
    orgId,
    "raw_data, industry, domain, annual_revenue",
  );
  snap.totalCompanies = companies.length;
  snap.companiesNoIndustry = companies.filter((c) => !c.industry).length;
  snap.companiesNoDomain = companies.filter((c) => !c.domain).length;
  snap.companiesNoRevenue = companies.filter((c) => !c.annual_revenue).length;

  // ── Pipelines (depuis hubspot_objects) ───────────────────────────────
  const { data: pipelinesRaw } = await supabase
    .from("hubspot_objects")
    .select("raw_data")
    .eq("organization_id", orgId)
    .eq("object_type", "pipelines");
  snap.pipelines = ((pipelinesRaw ?? []) as Array<{ raw_data: Record<string, unknown> }>).map((p) => {
    const r = p.raw_data;
    return {
      id: (r.pipelineId ?? r.id) as string,
      label: (r.label as string) ?? "Pipeline",
      displayOrder: Number(r.displayOrder ?? 0),
      archived: (r.archived as boolean) ?? false,
      stages: ((r.stages ?? []) as Array<Record<string, unknown>>).map((s) => {
        const meta = (s.metadata as Record<string, unknown>) ?? {};
        return {
          id: (s.stageId ?? s.id) as string,
          label: (s.label as string) ?? "",
          displayOrder: Number(s.displayOrder ?? 0),
          probability: Number(meta.probability ?? s.probability ?? 0),
          closedWon: meta.isClosed === "true" || meta.isClosedWon === "true",
          closedLost: meta.isClosed === "true" && meta.isClosedWon !== "true",
        };
      }),
    };
  });

  // ── Tickets ──────────────────────────────────────────────────────────
  const { count: ticketsTotal } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  snap.totalTickets = ticketsTotal ?? 0;

  const { count: openTicketsCount } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("closed_at", null);
  snap.openTickets = openTicketsCount ?? 0;
  snap.closedTickets = snap.totalTickets - snap.openTickets;

  // ── Owners (utilisateurs HubSpot) ────────────────────────────────────
  const { count: ownersCount } = await supabase
    .from("hubspot_objects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("object_type", "owners");
  snap.ownersCount = ownersCount ?? 0;
  snap.usersCount = snap.ownersCount; // proxy

  // ── Workflows ────────────────────────────────────────────────────────
  const { data: workflows } = await supabase
    .from("hubspot_objects")
    .select("raw_data")
    .eq("organization_id", orgId)
    .eq("object_type", "workflows");
  const wfList = (workflows ?? []) as Array<{ raw_data: Record<string, unknown> }>;
  snap.workflowsCount = wfList.length;
  snap.workflowsActiveCount = wfList.filter((w) => {
    const r = w.raw_data;
    return r.isEnabled === true || r.enabled === true;
  }).length;

  // ── Forms / Lists / Campaigns / Events ───────────────────────────────
  const counts = await Promise.all(
    (
      [
        ["forms", "formsCount"],
        ["lists", "listsCount"],
        ["marketing_campaigns", "marketingCampaignsCount"],
        ["marketing_events", "marketingEventsCount"],
        ["goals", "goalsCount"],
        ["leads", "leadsObjectCount"],
        ["invoices", "totalInvoices"],
        ["subscriptions", "totalSubscriptions"],
        ["quotes", "totalQuotes"],
        ["line_items", "totalLineItems"],
      ] as const
    ).map(async ([type, key]) => {
      const { count } = await supabase
        .from("hubspot_objects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("object_type", type);
      return [key, count ?? 0] as const;
    }),
  );
  for (const [key, value] of counts) {
    (snap as unknown as Record<string, number>)[key] = value;
  }

  return snap;
}

/**
 * Persiste le snapshot calculé dans hubspot_snapshot_cache.
 */
export async function persistSnapshotCache(
  supabase: SupabaseClient,
  orgId: string,
  snap: HubSpotSnapshot,
  source: "sync" | "live" | "bootstrap" = "sync",
): Promise<void> {
  await supabase.from("hubspot_snapshot_cache").upsert(
    {
      organization_id: orgId,
      snapshot: snap as unknown as Record<string, unknown>,
      computed_at: new Date().toISOString(),
      source,
    },
    { onConflict: "organization_id" },
  );
}
