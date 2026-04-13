/**
 * Universal Report KPI Engine
 *
 * Fetches data from HubSpot (contacts, deals, calls, meetings, emails,
 * tickets, companies, owners + associations) and Supabase (invoices,
 * subscriptions, payments) then computes a flat map of metric label → value.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const HS = "https://api.hubapi.com";

type HSRow = Record<string, string | null>;
type OwnerMap<T> = Map<string, T>;

// ── Month helper ──────────────────────────────────────────────────────────

function monthKey(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonth(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

// ── Aggregated types ──────────────────────────────────────────────────────

type ContactKpis = {
  total: number;
  orphans: number;
  withPhone: number;
  withJobtitle: number;
  withEmail: number;
  sourceSOCIAL: number;
  sourceOFFLINE: number;
  perOwner: OwnerMap<number>;
  withoutCompany: number;
  lifecycleCounts: Map<string, number>;
  perMonth: Map<string, number>;
};

type MonthlyDeal = { won: number; lost: number; caWon: number };
type PipelineStat = { active: number; won: number; lost: number; caWon: number; caActive: number; totalDays: number; daysCount: number };
type StageStat = { active: number; lost: number };

type DealKpis = {
  total: number;
  totalActive: number;
  totalClosedWon: number;
  totalClosedLost: number;
  orphans: number;
  caClosedWon: number;
  caActive: number;
  caWeighted: number;
  avgDealWon: number;
  avgDaysToClose: number;
  stagnantCount: number;
  stagnantAmount: number;
  perOwnerActive: OwnerMap<{ count: number; amount: number }>;
  perOwnerWon: OwnerMap<{ count: number; amount: number }>;
  perPipeline: Map<string, PipelineStat>;
  perStage: Map<string, StageStat>;
  withoutContact: number;
  withoutCompany: number;
  orphanAmount: number;
  sourceCounts: Map<string, { total: number; won: number; caWon: number; totalDays: number; daysCount: number }>;
  perMonth: Map<string, MonthlyDeal>;
  stagnantDeals: Array<{ amount: number; stage: string }>;
  timeInStageMs: number;
  dealsWithNotes: number;
  // Engagement association counts (filled after association fetch)
  dealsWithCalls: number;
  dealsWithMeetings: number;
  dealsWithEmails: number;
  wonWithCalls: number;
  wonWithMeetings: number;
  caWonWithCalls: number;
  caWonWithMeetings: number;
  callsOnWonDeals: number;
  meetingsOnWonDeals: number;
  emailsOnWonDeals: number;
  callsOnLostDeals: number;
  meetingsOnLostDeals: number;
  // Per deal engagement for averages
  totalCallsOnDeals: number;
  totalMeetingsOnDeals: number;
  totalEmailsOnDeals: number;
  dealsWonWith3PlusMeetings: number;
  caWonWith3PlusMeetings: number;
};

type CallKpis = { total: number; totalConnected: number; totalDurationMs: number; ownerCount: number; perOwner: OwnerMap<{ count: number; durationMs: number; connected: number }> };
type MeetingKpis = { total: number; totalCompleted: number; perOwner: OwnerMap<number> };
type EmailKpis = { totalSent: number; totalReceived: number; ownerCount: number; perOwner: OwnerMap<{ sent: number; received: number }> };
type TicketKpis = { total: number; open: number; closed: number; highPriority: number; perOwner: OwnerMap<{ open: number; closed: number }>; perPipeline: Map<string, number>; reopened: number; perChannel: Map<string, number> };
type CompanyKpis = { total: number; orphans: number; ownerCount: number; totalRevenue: number; perOwner: OwnerMap<{ count: number; revenue: number }>; perIndustry: Map<string, number> };

type InvoiceKpis = { count: number; totalBilled: number; totalPaid: number; pendingCount: number; pendingAmount: number; overdueCount: number };
type SubscriptionKpis = { mrr: number; arr: number; activeCount: number; totalCount: number };
type PaymentKpis = { total: number; succeeded: number; failed: number; totalFailedAmount: number; successRate: number };

export type AllKpiData = {
  ownerCount: number;
  contacts: ContactKpis;
  deals: DealKpis;
  calls: CallKpis;
  meetings: MeetingKpis;
  emails: EmailKpis;
  tickets: TicketKpis;
  companies: CompanyKpis;
  invoices: InvoiceKpis;
  subscriptions: SubscriptionKpis;
  payments: PaymentKpis;
  /** Pipeline ID → name, Stage ID → name */
  pipelineNames: Map<string, string>;
  stageNames: Map<string, string>;
};

// ── HubSpot list fetch ────────────────────────────────────────────────────

async function hsList(token: string, objectType: string, properties: string[], maxPages = 10): Promise<HSRow[]> {
  const rows: HSRow[] = [];
  let after: string | undefined;
  let pages = 0;
  try {
    do {
      const url = new URL(`${HS}/crm/v3/objects/${objectType}`);
      url.searchParams.set("limit", "100");
      url.searchParams.set("properties", properties.join(","));
      if (after) url.searchParams.set("after", after);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) break;
      const data = await res.json();
      for (const item of data.results ?? []) {
        const row = item.properties ?? {};
        row._hs_object_id = item.id; // preserve HubSpot ID for associations
        rows.push(row);
      }
      after = data.paging?.next?.after;
      pages++;
    } while (after && pages < maxPages);
  } catch { /* return collected */ }
  return rows;
}

async function fetchOwnerCount(token: string): Promise<number> {
  try {
    const res = await fetch(`${HS}/crm/v3/owners?limit=100`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return 1;
    const data = await res.json();
    return Math.max(1, (data.results ?? []).length);
  } catch { return 1; }
}

async function fetchPipelineNames(token: string): Promise<{ pipelines: Map<string, string>; stages: Map<string, string> }> {
  const pipelines = new Map<string, string>();
  const stages = new Map<string, string>();
  try {
    const res = await fetch(`${HS}/crm/v3/pipelines/deals`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return { pipelines, stages };
    const data = await res.json();
    for (const p of data.results ?? []) {
      pipelines.set(p.id, p.label);
      for (const s of p.stages ?? []) {
        stages.set(s.id, s.label);
      }
    }
  } catch {}
  return { pipelines, stages };
}

// ── HubSpot Associations batch read ──────────────────────────────────────

type AssocMap = Map<string, string[]>; // dealId → [engagementId, ...]

async function fetchAssociations(token: string, fromType: string, toType: string, ids: string[]): Promise<AssocMap> {
  const map: AssocMap = new Map();
  if (ids.length === 0) return map;

  // Batch in chunks of 500
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    try {
      const res = await fetch(`${HS}/crm/v4/associations/${fromType}/${toType}/batch/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const result of data.results ?? []) {
        const fromId = result.from?.id;
        const toIds = (result.to ?? []).map((t: { toObjectId: string }) => t.toObjectId);
        if (fromId && toIds.length > 0) map.set(fromId, toIds);
      }
    } catch { /* skip chunk */ }
  }
  return map;
}

// ── Supabase fetchers ──────────────────────────────────────────────────────

type RawInvoice = { amount_total: number; amount_paid: number; status: string; due_date?: string };
type RawSubscription = { mrr: number; status: string };
type RawPayment = { status: string; amount: number };

async function sbInvoices(sb: SupabaseClient, orgId: string): Promise<RawInvoice[]> {
  const { data } = await sb.from("invoices").select("amount_total, amount_paid, status, due_date").eq("organization_id", orgId);
  return (data ?? []) as RawInvoice[];
}
async function sbSubscriptions(sb: SupabaseClient, orgId: string): Promise<RawSubscription[]> {
  const { data } = await sb.from("subscriptions").select("mrr, status").eq("organization_id", orgId);
  return (data ?? []) as RawSubscription[];
}
async function sbPayments(sb: SupabaseClient, orgId: string): Promise<RawPayment[]> {
  const { data } = await sb.from("payments").select("status, amount").eq("organization_id", orgId);
  return (data ?? []) as RawPayment[];
}

// ── Aggregators ────────────────────────────────────────────────────────────

function aggregateContacts(rows: HSRow[]): ContactKpis {
  const perOwner = new Map<string, number>();
  const lifecycleCounts = new Map<string, number>();
  const perMonth = new Map<string, number>();
  let orphans = 0, withPhone = 0, withJobtitle = 0, withEmail = 0;
  let sourceSOCIAL = 0, sourceOFFLINE = 0, withoutCompany = 0;

  for (const r of rows) {
    const owner = r.hubspot_owner_id ?? null;
    if (!owner) orphans++;
    else perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);

    if (r.phone) withPhone++;
    if (r.jobtitle) withJobtitle++;
    if (r.email) withEmail++;
    if (!r.associatedcompanyid) withoutCompany++;

    const src = (r.hs_analytics_source ?? "").toUpperCase();
    if (["SOCIAL_MEDIA", "ORGANIC_SOCIAL", "SOCIAL"].some((t) => src.includes(t))) sourceSOCIAL++;
    if (["OFFLINE", "EMAIL_MARKETING", "PAID_SEARCH", "PAID_SOCIAL"].some((t) => src.includes(t))) sourceOFFLINE++;

    const lc = (r.lifecyclestage ?? "unknown").toLowerCase();
    lifecycleCounts.set(lc, (lifecycleCounts.get(lc) ?? 0) + 1);

    const mk = monthKey(r.createdate);
    if (mk) perMonth.set(mk, (perMonth.get(mk) ?? 0) + 1);
  }

  return { total: rows.length, orphans, withPhone, withJobtitle, withEmail, sourceSOCIAL, sourceOFFLINE, perOwner, withoutCompany, lifecycleCounts, perMonth };
}

function aggregateDeals(rows: HSRow[]): DealKpis {
  const perOwnerActive = new Map<string, { count: number; amount: number }>();
  const perOwnerWon = new Map<string, { count: number; amount: number }>();
  const perPipeline = new Map<string, PipelineStat>();
  const perStage = new Map<string, StageStat>();
  const sourceCounts = new Map<string, { total: number; won: number; caWon: number; totalDays: number; daysCount: number }>();
  const perMonth = new Map<string, MonthlyDeal>();
  const stagnantDeals: Array<{ amount: number; stage: string }> = [];

  let orphans = 0, caClosedWon = 0, caActive = 0, caWeighted = 0;
  let totalClosedWon = 0, totalClosedLost = 0, totalActive = 0;
  let sumDays = 0, daysCount = 0, stagnantCount = 0, stagnantAmount = 0;
  let withoutContact = 0, withoutCompany = 0, orphanAmount = 0;
  let timeInStageMs = 0, dealsWithNotes = 0;

  for (const d of rows) {
    const isClosed = d.hs_is_closed === "true";
    const isWon = d.hs_is_closed_won === "true";
    const amount = Number(d.amount ?? 0);
    const prob = Number(d.hs_deal_stage_probability ?? 0);
    const days = Number(d.days_to_close ?? 0);
    const owner = d.hubspot_owner_id ?? null;
    const pipeline = d.pipeline ?? "default";
    const stage = d.dealstage ?? "unknown";
    const source = (d.hs_analytics_source ?? "").toUpperCase();
    const closedate = d.closedate ?? null;
    const stageTime = Number(d.hs_time_in_latest_deal_stage ?? 0);
    const notes = Number(d.num_notes ?? 0);

    if (stageTime > 0) timeInStageMs += stageTime;
    if (notes > 0) dealsWithNotes++;

    // Per pipeline
    const pp = perPipeline.get(pipeline) ?? { active: 0, won: 0, lost: 0, caWon: 0, caActive: 0, totalDays: 0, daysCount: 0 };

    // Per source
    if (source) {
      const sc = sourceCounts.get(source) ?? { total: 0, won: 0, caWon: 0, totalDays: 0, daysCount: 0 };
      sc.total++;
      if (isWon) { sc.won++; sc.caWon += amount; if (days > 0) { sc.totalDays += days; sc.daysCount++; } }
      sourceCounts.set(source, sc);
    }

    // Per month
    const mk = monthKey(closedate);

    if (isWon) {
      totalClosedWon++;
      caClosedWon += amount;
      pp.won++; pp.caWon += amount;
      if (days > 0) { sumDays += days; daysCount++; pp.totalDays += days; pp.daysCount++; }
      if (owner) {
        const e = perOwnerWon.get(owner) ?? { count: 0, amount: 0 };
        perOwnerWon.set(owner, { count: e.count + 1, amount: e.amount + amount });
      }
      if (mk) {
        const mm = perMonth.get(mk) ?? { won: 0, lost: 0, caWon: 0 };
        mm.won++; mm.caWon += amount;
        perMonth.set(mk, mm);
      }
    } else if (isClosed) {
      totalClosedLost++;
      pp.lost++;
      // Per stage lost
      const ss = perStage.get(stage) ?? { active: 0, lost: 0 };
      ss.lost++;
      perStage.set(stage, ss);
      if (mk) {
        const mm = perMonth.get(mk) ?? { won: 0, lost: 0, caWon: 0 };
        mm.lost++;
        perMonth.set(mk, mm);
      }
    } else {
      totalActive++;
      caActive += amount;
      caWeighted += amount * prob / 100;
      pp.active++; pp.caActive += amount;
      // Per stage active
      const ss = perStage.get(stage) ?? { active: 0, lost: 0 };
      ss.active++;
      perStage.set(stage, ss);
      if (days > 30) { stagnantCount++; stagnantAmount += amount; stagnantDeals.push({ amount, stage }); }
      if (!owner) { orphans++; orphanAmount += amount; }
      else {
        const e = perOwnerActive.get(owner) ?? { count: 0, amount: 0 };
        perOwnerActive.set(owner, { count: e.count + 1, amount: e.amount + amount });
      }
    }

    if (!d.num_associated_contacts || d.num_associated_contacts === "0") withoutContact++;
    if (!d.hs_num_associated_company || d.hs_num_associated_company === "0") withoutCompany++;

    perPipeline.set(pipeline, pp);
  }

  return {
    total: rows.length, totalActive, totalClosedWon, totalClosedLost,
    orphans, caClosedWon, caActive, caWeighted,
    avgDealWon: totalClosedWon > 0 ? caClosedWon / totalClosedWon : 0,
    avgDaysToClose: daysCount > 0 ? sumDays / daysCount : 0,
    stagnantCount, stagnantAmount,
    perOwnerActive, perOwnerWon, perPipeline, perStage,
    withoutContact, withoutCompany, orphanAmount, sourceCounts,
    perMonth, stagnantDeals, timeInStageMs, dealsWithNotes,
    // Engagement fields — filled later by enrichDealEngagements
    dealsWithCalls: 0, dealsWithMeetings: 0, dealsWithEmails: 0,
    wonWithCalls: 0, wonWithMeetings: 0,
    caWonWithCalls: 0, caWonWithMeetings: 0,
    callsOnWonDeals: 0, meetingsOnWonDeals: 0, emailsOnWonDeals: 0,
    callsOnLostDeals: 0, meetingsOnLostDeals: 0,
    totalCallsOnDeals: 0, totalMeetingsOnDeals: 0, totalEmailsOnDeals: 0,
    dealsWonWith3PlusMeetings: 0, caWonWith3PlusMeetings: 0,
  };
}

/** Enrich deal KPIs with engagement association data */
function enrichDealEngagements(
  deals: DealKpis,
  rawDeals: HSRow[],
  callAssoc: AssocMap,
  meetingAssoc: AssocMap,
  emailAssoc: AssocMap,
) {
  for (const d of rawDeals) {
    const id = d._hs_object_id ?? "";
    const isWon = d.hs_is_closed_won === "true";
    const isLost = d.hs_is_closed === "true" && !isWon;
    const amount = Number(d.amount ?? 0);

    const nCalls = (callAssoc.get(id) ?? []).length;
    const nMeetings = (meetingAssoc.get(id) ?? []).length;
    const nEmails = (emailAssoc.get(id) ?? []).length;

    if (nCalls > 0) { deals.dealsWithCalls++; deals.totalCallsOnDeals += nCalls; }
    if (nMeetings > 0) { deals.dealsWithMeetings++; deals.totalMeetingsOnDeals += nMeetings; }
    if (nEmails > 0) { deals.dealsWithEmails++; deals.totalEmailsOnDeals += nEmails; }

    if (isWon) {
      if (nCalls > 0) { deals.wonWithCalls++; deals.caWonWithCalls += amount; deals.callsOnWonDeals += nCalls; }
      if (nMeetings > 0) { deals.wonWithMeetings++; deals.caWonWithMeetings += amount; deals.meetingsOnWonDeals += nMeetings; }
      if (nEmails > 0) deals.emailsOnWonDeals += nEmails;
      if (nMeetings >= 3) { deals.dealsWonWith3PlusMeetings++; deals.caWonWith3PlusMeetings += amount; }
    }
    if (isLost) {
      deals.callsOnLostDeals += nCalls;
      deals.meetingsOnLostDeals += nMeetings;
    }
  }
}

function aggregateCalls(rows: HSRow[]): CallKpis {
  let totalConnected = 0, totalDurationMs = 0;
  const ownerSet = new Set<string>();
  const perOwner = new Map<string, { count: number; durationMs: number; connected: number }>();
  for (const r of rows) {
    const owner = r.hubspot_owner_id ?? null;
    const dur = Number(r.hs_call_duration ?? 0);
    const connected = (r.hs_call_disposition ?? "").toUpperCase().includes("CONNECT");
    if (connected) totalConnected++;
    totalDurationMs += dur;
    if (owner) {
      ownerSet.add(owner);
      const e = perOwner.get(owner) ?? { count: 0, durationMs: 0, connected: 0 };
      e.count++; e.durationMs += dur; if (connected) e.connected++;
      perOwner.set(owner, e);
    }
  }
  return { total: rows.length, totalConnected, totalDurationMs, ownerCount: ownerSet.size || 1, perOwner };
}

function aggregateMeetings(rows: HSRow[]): MeetingKpis {
  const totalCompleted = rows.filter((r) => r.hs_meeting_outcome === "COMPLETED").length;
  const perOwner = new Map<string, number>();
  for (const r of rows) {
    const owner = r.hubspot_owner_id ?? null;
    if (owner) perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);
  }
  return { total: rows.length, totalCompleted, perOwner };
}

function aggregateEmails(rows: HSRow[]): EmailKpis {
  let totalSent = 0, totalReceived = 0;
  const ownerSet = new Set<string>();
  const perOwner = new Map<string, { sent: number; received: number }>();
  for (const r of rows) {
    const owner = r.hubspot_owner_id ?? null;
    const isSent = r.hs_email_direction === "EMAIL";
    const isReceived = r.hs_email_direction === "INCOMING_EMAIL";
    if (isSent) totalSent++;
    if (isReceived) totalReceived++;
    if (owner) {
      ownerSet.add(owner);
      const e = perOwner.get(owner) ?? { sent: 0, received: 0 };
      if (isSent) e.sent++;
      if (isReceived) e.received++;
      perOwner.set(owner, e);
    }
  }
  return { totalSent, totalReceived, ownerCount: ownerSet.size || 1, perOwner };
}

function aggregateTickets(rows: HSRow[]): TicketKpis {
  const CLOSED = new Set(["4", "CLOSED", "RESOLVED", "closed"]);
  let open = 0, closed = 0, highPriority = 0, reopened = 0;
  const perOwner = new Map<string, { open: number; closed: number }>();
  const perPipeline = new Map<string, number>();
  const perChannel = new Map<string, number>();
  for (const r of rows) {
    const isClosed = CLOSED.has(r.hs_pipeline_stage ?? "");
    if (isClosed) closed++; else open++;
    if (r.hs_ticket_priority === "HIGH") highPriority++;
    if (r.hs_was_reopened === "true") reopened++;
    const owner = r.hubspot_owner_id ?? null;
    if (owner) {
      const e = perOwner.get(owner) ?? { open: 0, closed: 0 };
      if (isClosed) e.closed++; else e.open++;
      perOwner.set(owner, e);
    }
    const pl = r.hs_pipeline ?? "default";
    perPipeline.set(pl, (perPipeline.get(pl) ?? 0) + 1);
    const ch = r.hs_ticket_category ?? r.source_type ?? "unknown";
    perChannel.set(ch, (perChannel.get(ch) ?? 0) + 1);
  }
  return { total: rows.length, open, closed, highPriority, perOwner, perPipeline, reopened, perChannel };
}

function aggregateCompanies(rows: HSRow[]): CompanyKpis {
  let orphans = 0, totalRevenue = 0;
  const ownerSet = new Set<string>();
  const perOwner = new Map<string, { count: number; revenue: number }>();
  const perIndustry = new Map<string, number>();
  for (const r of rows) {
    const rev = Number(r.annualrevenue ?? 0);
    totalRevenue += rev;
    if (!r.hubspot_owner_id) orphans++;
    else {
      ownerSet.add(r.hubspot_owner_id);
      const e = perOwner.get(r.hubspot_owner_id) ?? { count: 0, revenue: 0 };
      e.count++; e.revenue += rev;
      perOwner.set(r.hubspot_owner_id, e);
    }
    const ind = r.industry ?? "Non défini";
    perIndustry.set(ind, (perIndustry.get(ind) ?? 0) + 1);
  }
  return { total: rows.length, orphans, ownerCount: ownerSet.size || 1, totalRevenue, perOwner, perIndustry };
}

function aggregateInvoices(rows: RawInvoice[]): InvoiceKpis {
  let totalBilled = 0, totalPaid = 0, pendingCount = 0, pendingAmount = 0, overdueCount = 0;
  const now = Date.now();
  for (const i of rows) {
    const billed = Number(i.amount_total ?? 0);
    const paid = Number(i.amount_paid ?? 0);
    totalBilled += billed;
    totalPaid += paid;
    if (i.status !== "paid" && i.status !== "void") {
      pendingCount++;
      pendingAmount += billed - paid;
      if (i.due_date && new Date(i.due_date).getTime() < now) overdueCount++;
    }
  }
  return { count: rows.length, totalBilled, totalPaid, pendingCount, pendingAmount, overdueCount };
}

function aggregateSubscriptions(rows: RawSubscription[]): SubscriptionKpis {
  const active = rows.filter((r) => r.status === "active");
  const mrr = active.reduce((s, r) => s + Number(r.mrr ?? 0), 0);
  return { mrr, arr: mrr * 12, activeCount: active.length, totalCount: rows.length };
}

function aggregatePayments(rows: RawPayment[]): PaymentKpis {
  let succeeded = 0, failed = 0, totalFailedAmount = 0;
  for (const p of rows) {
    if (p.status === "succeeded" || p.status === "paid") succeeded++;
    else if (p.status === "failed") { failed++; totalFailedAmount += Number(p.amount ?? 0); }
  }
  const total = succeeded + failed;
  return { total, succeeded, failed, totalFailedAmount, successRate: total > 0 ? succeeded / total * 100 : 0 };
}

// ── Public: fetch all data ─────────────────────────────────────────────────

export async function fetchAllKpiData(token: string, supabase: SupabaseClient, orgId: string): Promise<AllKpiData> {
  const [ownerCount, pipelineData, rawContacts, rawDeals, rawCalls, rawMeetings, rawEmails, rawTickets, rawCompanies, rawInvoices, rawSubs, rawPayments] = await Promise.all([
    fetchOwnerCount(token).catch(() => 1),
    fetchPipelineNames(token).catch(() => ({ pipelines: new Map<string, string>(), stages: new Map<string, string>() })),
    hsList(token, "contacts", [
      "hubspot_owner_id", "hs_analytics_source", "phone", "jobtitle", "email",
      "lifecyclestage", "associatedcompanyid", "createdate",
    ], 10).catch(() => []),
    hsList(token, "deals", [
      "hubspot_owner_id", "amount", "hs_is_closed", "hs_is_closed_won", "pipeline",
      "days_to_close", "hs_deal_stage_probability", "dealstage",
      "hs_analytics_source", "num_associated_contacts", "hs_num_associated_company",
      "closedate", "createdate", "hs_time_in_latest_deal_stage", "num_notes",
    ], 5).catch(() => []),
    hsList(token, "calls", ["hubspot_owner_id", "hs_call_duration", "hs_call_disposition"], 5).catch(() => []),
    hsList(token, "meetings", ["hubspot_owner_id", "hs_meeting_outcome"], 3).catch(() => []),
    hsList(token, "emails", ["hubspot_owner_id", "hs_email_direction"], 5).catch(() => []),
    hsList(token, "tickets", [
      "hubspot_owner_id", "hs_ticket_priority", "hs_pipeline_stage",
      "hs_pipeline", "hs_was_reopened", "hs_ticket_category", "source_type",
    ], 3).catch(() => []),
    hsList(token, "companies", ["hubspot_owner_id", "annualrevenue", "industry"], 5).catch(() => []),
    sbInvoices(supabase, orgId).catch(() => []),
    sbSubscriptions(supabase, orgId).catch(() => []),
    sbPayments(supabase, orgId).catch(() => []),
  ]);

  const dealData = aggregateDeals(rawDeals);

  // Fetch engagement associations for deals (calls, meetings, emails)
  const dealIds = rawDeals.map((d) => d._hs_object_id).filter((id): id is string => !!id);
  if (dealIds.length > 0) {
    const [callAssoc, meetingAssoc, emailAssoc] = await Promise.all([
      fetchAssociations(token, "deals", "calls", dealIds).catch(() => new Map()),
      fetchAssociations(token, "deals", "meetings", dealIds).catch(() => new Map()),
      fetchAssociations(token, "deals", "emails", dealIds).catch(() => new Map()),
    ]);
    enrichDealEngagements(dealData, rawDeals, callAssoc, meetingAssoc, emailAssoc);
  }

  return {
    ownerCount,
    contacts: aggregateContacts(rawContacts),
    deals: dealData,
    calls: aggregateCalls(rawCalls),
    meetings: aggregateMeetings(rawMeetings),
    emails: aggregateEmails(rawEmails),
    tickets: aggregateTickets(rawTickets),
    companies: aggregateCompanies(rawCompanies),
    invoices: aggregateInvoices(rawInvoices),
    subscriptions: aggregateSubscriptions(rawSubs),
    payments: aggregatePayments(rawPayments),
    pipelineNames: pipelineData.pipelines,
    stageNames: pipelineData.stages,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function topEntry<T>(map: Map<string, T>, valueFn: (v: T) => number): [string, T] | null {
  let best: [string, T] | null = null;
  for (const [k, v] of map) {
    if (!best || valueFn(v) > valueFn(best[1])) best = [k, v];
  }
  return best;
}

function latestMonth(map: Map<string, unknown>): string | null {
  const keys = [...map.keys()].sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

// ── Public: compute metric values ─────────────────────────────────────────

export function computeMetricValues(data: AllKpiData): Record<string, string | null> {
  const { ownerCount, contacts, deals, calls, meetings, emails, tickets, companies, invoices, subscriptions, payments, pipelineNames, stageNames } = data;

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
  const fmtDec = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const pct = (n: number) => `${Math.round(n)} %`;
  const has = (n: number) => n > 0;
  // Resolve pipeline/stage IDs to names
  const plName = (id: string) => pipelineNames.get(id) ?? id;
  const stName = (id: string) => stageNames.get(id) ?? id;

  const oc = ownerCount || 1;
  const contactTotal = contacts.total || 1;

  // Contacts derived
  const topOwnerContacts = contacts.perOwner.size > 0 ? Math.max(...contacts.perOwner.values()) : 0;
  const topOwnerPct = contacts.total > 0 ? topOwnerContacts / contacts.total * 100 : 0;
  const avgContactsPerOwner = contacts.perOwner.size > 0 ? (contacts.total - contacts.orphans) / contacts.perOwner.size : 0;
  const enrichmentRate = contacts.total > 0 ? contacts.withPhone / contacts.total * 100 : 0;
  const fieldCompleteness = contacts.total > 0 ? (contacts.withEmail + contacts.withPhone + contacts.withJobtitle) / (3 * contacts.total) * 100 : 0;
  const contactToDealRate = contacts.total > 0 ? deals.total / contacts.total * 100 : 0;

  // Deals derived
  const activeOwnerCount = deals.perOwnerActive.size || oc;
  const avgDealsPerOwner = activeOwnerCount > 0 ? deals.totalActive / activeOwnerCount : 0;
  const avgAmountPerOwner = activeOwnerCount > 0 ? deals.caActive / activeOwnerCount : 0;
  const wonOwnerCount = deals.perOwnerWon.size || oc;
  const avgWonPerOwner = wonOwnerCount > 0 ? deals.totalClosedWon / wonOwnerCount : 0;
  const avgWonAmountPerOwner = wonOwnerCount > 0 ? deals.caClosedWon / wonOwnerCount : 0;
  const totalClosed = deals.totalClosedWon + deals.totalClosedLost;
  const convRate = totalClosed > 0 ? deals.totalClosedWon / totalClosed * 100 : 0;
  const weightedPerOwner = activeOwnerCount > 0 ? deals.caWeighted / activeOwnerCount : 0;

  // Monthly evolution
  const latMo = latestMonth(deals.perMonth);
  const prevMo = latMo ? prevMonth(latMo) : null;
  const latMonthData = latMo ? deals.perMonth.get(latMo) : null;
  const prevMonthData = prevMo ? deals.perMonth.get(prevMo) : null;
  const monthEvolution = latMonthData && prevMonthData && prevMonthData.caWon > 0
    ? ((latMonthData.caWon - prevMonthData.caWon) / prevMonthData.caWon * 100) : null;

  // Stage with most lost deals
  const worstStage = topEntry(deals.perStage, (v) => v.lost);
  // Most blocked stage (active deals)
  const mostBlockedStage = topEntry(deals.perStage, (v) => v.active);

  // Calls derived
  const avgCallsPerOwnerPerDay = calls.total > 0 ? calls.total / calls.ownerCount / 30 : 0;
  const avgCallHoursPerOwner = calls.total > 0 ? calls.totalDurationMs / calls.ownerCount / 3_600_000 : 0;
  const callConnectionRate = calls.total > 0 ? calls.totalConnected / calls.total * 100 : 0;
  const avgCallDurationMin = calls.total > 0 ? calls.totalDurationMs / calls.total / 60000 : 0;

  // Meetings derived
  const showUpRate = meetings.total > 0 ? meetings.totalCompleted / meetings.total * 100 : 0;

  // Emails derived
  const avgEmailsSentPerOwnerPerWeek = emails.totalSent > 0 ? emails.totalSent / emails.ownerCount / 4 : 0;
  const avgEmailsReceivedPerOwner = emails.totalReceived > 0 ? emails.totalReceived / emails.ownerCount : 0;
  const replyRate = emails.totalSent > 0 ? emails.totalReceived / emails.totalSent * 100 : 0;

  // Tickets derived
  const csatProxy = tickets.total > 0 ? tickets.closed / tickets.total * 100 : 0;

  // Companies derived
  const avgCompaniesPerOwner = companies.ownerCount > 0 ? (companies.total - companies.orphans) / companies.ownerCount : 0;
  const avgRevenuePerOwner = companies.perOwner.size > 0 ? companies.totalRevenue / companies.perOwner.size : 0;

  // Pipeline top
  const topPipeline = topEntry(deals.perPipeline, (v) => v.caWon);
  const topIndustry = topEntry(companies.perIndustry, (v) => v);
  const topCallOwner = topEntry(calls.perOwner, (v) => v.count);
  const topEmailOwner = topEntry(emails.perOwner, (v) => v.sent);

  // Source data
  const socialSource = deals.sourceCounts.get("SOCIAL") ?? deals.sourceCounts.get("ORGANIC_SOCIAL") ?? { total: 0, won: 0, caWon: 0, totalDays: 0, daysCount: 0 };
  const outboundKeys = ["OFFLINE", "EMAIL_MARKETING", "PAID_SEARCH", "PAID_SOCIAL"];
  const outbound = outboundKeys.reduce((a, k) => {
    const s = deals.sourceCounts.get(k);
    if (s) { a.total += s.total; a.won += s.won; a.caWon += s.caWon; a.totalDays += s.totalDays; a.daysCount += s.daysCount; }
    return a;
  }, { total: 0, won: 0, caWon: 0, totalDays: 0, daysCount: 0 });

  // Engagement derived (from associations)
  const avgCallsPerWonDeal = deals.wonWithCalls > 0 ? deals.callsOnWonDeals / deals.wonWithCalls : 0;
  const avgCallsPerLostDeal = deals.totalClosedLost > 0 ? deals.callsOnLostDeals / deals.totalClosedLost : 0;
  const avgMeetingsPerWonDeal = deals.wonWithMeetings > 0 ? deals.meetingsOnWonDeals / deals.wonWithMeetings : 0;
  const pctWonWithCall = deals.totalClosedWon > 0 ? deals.wonWithCalls / deals.totalClosedWon * 100 : 0;
  const avgEmailsPerDeal = deals.dealsWithEmails > 0 ? deals.totalEmailsOnDeals / deals.dealsWithEmails : 0;

  // Top stagnant stage
  const stagnantByStage = new Map<string, number>();
  for (const sd of deals.stagnantDeals) stagnantByStage.set(sd.stage, (stagnantByStage.get(sd.stage) ?? 0) + 1);
  const topStagnantStage = topEntry(stagnantByStage, (v) => v);

  // ── BUILD METRIC MAP ───────────────────────────────────────────────────

  const V: Record<string, string | null> = {};

  // ATTRIBUTION — CONTACTS
  V["Nb de contacts par owner"] = has(contacts.total) ? `${fmt(avgContactsPerOwner)}  par owner` : null;
  V["% de la base par owner"] = has(contacts.total) ? pct(topOwnerPct) : null;
  V["Contacts sans owner (non attribués)"] = has(contacts.total) ? fmt(contacts.orphans) : null;
  V["Évolution mensuelle de l'attribution"] = contacts.perMonth.size >= 2
    ? [...contacts.perMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-4).map(([k, v]) => `${k.slice(5)}/${k.slice(2, 4)} ${fmt(v)}`).join(" → ")
    : null;
  V["% de contacts attribués par owner"] = has(contacts.total) ? pct((contacts.total - contacts.orphans) / contacts.total * 100) : null;
  V["Nb de contacts orphelins (sans owner)"] = has(contacts.total) ? fmt(contacts.orphans) : null;
  V["Nb de contacts créés par source outbound"] = has(contacts.total) ? fmt(contacts.sourceOFFLINE) : null;
  V["Taux de conversion contact → deal par source"] = has(contacts.total) && has(deals.total) ? pct(contactToDealRate) : null;
  V["Nb de contacts source SOCIAL"] = has(contacts.total) ? fmt(contacts.sourceSOCIAL) : null;
  V["% des contacts totaux issus du social"] = has(contacts.total) ? pct(contacts.sourceSOCIAL / contacts.total * 100) : null;
  V["% de contacts orphelins"] = has(contacts.total) ? pct(contacts.orphans / contacts.total * 100) : null;
  V["% de contacts enrichis dans la base"] = has(contacts.total) ? pct(enrichmentRate) : null;
  V["% de contacts enrichis par owner"] = has(contacts.total) ? pct(enrichmentRate) : null;
  V["Complétude par champ clé (%)"] = has(contacts.total) ? pct(fieldCompleteness) : null;

  // ATTRIBUTION — DEALS
  V["Nb de deals par owner"] = has(deals.totalActive) ? `${fmt(avgDealsPerOwner)}  par owner` : null;
  V["Montant total du pipeline par owner (€)"] = has(deals.caActive) ? eur(avgAmountPerOwner) : null;
  V["Nb de deals sans owner"] = has(deals.total) ? fmt(deals.orphans) : null;
  V["Deals par owner par pipeline"] = deals.perPipeline.size > 0
    ? [...deals.perPipeline.entries()].map(([k, v]) => `${plName(k)} ${fmt(v.active)}`).join(" · ") : null;
  V["Taux de conversion global pipeline → Won"] = has(totalClosed) ? pct(convRate) : null;
  V["Nb de deals stagnants (>30j même stage)"] = has(deals.total) ? fmt(deals.stagnantCount) : null;
  V["Montant total des deals stagnants (€)"] = has(deals.stagnantAmount) ? eur(deals.stagnantAmount) : null;
  V["Top 10 deals bloqués par montant"] = deals.stagnantDeals.length > 0
    ? `${fmt(Math.min(10, deals.stagnantDeals.length))} deals · ${eur(deals.stagnantDeals.sort((a, b) => b.amount - a.amount).slice(0, 10).reduce((s, d) => s + d.amount, 0))}` : null;
  V["Stage où les deals bloquent le plus"] = topStagnantStage ? `${stName(topStagnantStage[0])} · ${fmt(topStagnantStage[1])} deals` : (mostBlockedStage ? `${stName(mostBlockedStage[0])} · ${fmt(mostBlockedStage[1].active)} deals` : null);
  V["Taux de conversion entre chaque stage (%)"] = has(totalClosed) ? pct(convRate) : null;
  V["Stage avec le plus de déperdition"] = worstStage && worstStage[1].lost > 0 ? `${stName(worstStage[0])} (${fmt(worstStage[1].lost)} perdus)` : null;
  V["Évolution mensuelle des taux de conversion"] = monthEvolution !== null ? `${monthEvolution > 0 ? "+" : ""}${Math.round(monthEvolution)} %` : null;

  // ATTRIBUTION — COMPANIES
  V["Nb de companies par owner"] = has(companies.total) ? `${fmt(avgCompaniesPerOwner)}  par owner` : null;
  V["Revenue annuel total des companies par owner (€)"] = has(companies.totalRevenue) ? eur(avgRevenuePerOwner) : null;
  V["Companies sans owner"] = has(companies.total) ? fmt(companies.orphans) : null;
  V["Répartition par industrie par owner"] = topIndustry ? `${topIndustry[0]} (${fmt(topIndustry[1])})` : null;

  // CHIFFRE D'AFFAIRES
  V["Nb de deals Closed Won par mois"] = latMonthData ? fmt(latMonthData.won) : (has(deals.totalClosedWon) ? fmt(deals.totalClosedWon) : null);
  V["CA total Closed Won par mois (€)"] = latMonthData ? eur(latMonthData.caWon) : (has(deals.caClosedWon) ? eur(deals.caClosedWon) : null);
  V["Deal moyen Closed Won (€)"] = has(deals.totalClosedWon) ? eur(deals.avgDealWon) : null;
  V["Évolution vs mois précédent (%)"] = monthEvolution !== null ? `${monthEvolution > 0 ? "+" : ""}${Math.round(monthEvolution)} %` : null;
  V["CA Closed Won par pipeline (€)"] = topPipeline ? eur(topPipeline[1].caWon) : null;
  V["Nb de deals Won par pipeline"] = topPipeline ? fmt(topPipeline[1].won) : null;
  V["Deal moyen par pipeline (€)"] = topPipeline && has(topPipeline[1].won) ? eur(topPipeline[1].caWon / topPipeline[1].won) : null;
  V["Taux de conversion par pipeline (%)"] = topPipeline && (topPipeline[1].won + topPipeline[1].lost) > 0
    ? pct(topPipeline[1].won / (topPipeline[1].won + topPipeline[1].lost) * 100) : null;
  V["CA Closed Won par owner (€)"] = has(deals.totalClosedWon) ? `${eur(avgWonAmountPerOwner)}  par owner` : null;
  V["Nb de deals Won par owner"] = has(deals.totalClosedWon) ? `${fmt(avgWonPerOwner)}  par owner` : null;
  V["Deal moyen par owner (€)"] = has(deals.totalClosedWon) ? eur(deals.avgDealWon) : null;
  V["% d'atteinte de quota par owner"] = null; // needs quota data
  V["CA réalisé Closed Won (€)"] = has(deals.caClosedWon) ? eur(deals.caClosedWon) : null;
  V["Écart forecast vs réalisé (%)"] = has(deals.caWeighted) && has(deals.caClosedWon) ? pct(Math.abs(deals.caClosedWon - deals.caWeighted) / deals.caWeighted * 100) : null;
  V["Précision du forecast par owner"] = null; // needs per-owner forecast targets
  V["Pipeline weighted total (€)"] = has(deals.caWeighted) ? eur(deals.caWeighted) : null;
  V["Pipeline weighted par mois de closing attendu"] = null; // needs hs_date_closed_expected
  V["Pipeline weighted par owner"] = has(deals.caWeighted) ? `${eur(weightedPerOwner)}  par owner` : null;
  V["Couverture pipeline vs objectif (%)"] = null; // needs objective data

  // OUTBOUND
  V["CA total Closed Won issu de l'outbound (€)"] = has(outbound.caWon) ? eur(outbound.caWon) : null;
  V["CA moyen par séquence"] = null; // needs sequence data
  V["Nb de deals Closed Won par campagne"] = has(outbound.won) ? fmt(outbound.won) : null;
  V["ROI par campagne (CA / coût outil)"] = null; // needs cost data
  V["Durée moyenne first-touch → Closed Won (jours)"] = has(deals.avgDaysToClose) ? `${fmt(deals.avgDaysToClose)} j` : null;
  V["Durée médiane par pipeline"] = topPipeline && has(topPipeline[1].daysCount)
    ? `${fmt(topPipeline[1].totalDays / topPipeline[1].daysCount)} j` : null;
  V["Temps par étape (hs_time_in_latest_deal_stage)"] = has(deals.timeInStageMs)
    ? `${fmtDec(deals.timeInStageMs / Math.max(1, deals.total) / 86_400_000)} j/étape` : null;
  V["Comparaison outbound vs inbound"] = (has(outbound.total) || has(socialSource.total))
    ? `${fmt(outbound.won)} outbound · ${fmt(socialSource.won)} inbound` : null;

  // CALLING
  V["Nb d'appels par owner / jour"] = has(calls.total) ? `${fmtDec(avgCallsPerOwnerPerDay)} par jour` : null;
  V["Durée totale d'appels par owner (h)"] = has(calls.total) ? `${fmtDec(avgCallHoursPerOwner)} h` : null;
  V["Taux de connexion (décrochés / tentés)"] = has(calls.total) ? pct(callConnectionRate) : null;
  V["Nb de deals touchés par les appels par owner"] = has(deals.dealsWithCalls) ? `${fmt(deals.dealsWithCalls / calls.ownerCount)}  par owner` : null;
  V["Nb moyen d'appels par deal gagné vs perdu"] = has(deals.wonWithCalls)
    ? `${fmtDec(avgCallsPerWonDeal)} gagnés · ${fmtDec(avgCallsPerLostDeal)} perdus` : null;
  V["Durée moyenne des appels sur deals won"] = has(calls.total) ? `${fmtDec(avgCallDurationMin)} min` : null;
  V["Conversion call → avancement de stage"] = null; // needs call timestamp + deal stage history
  V["Délai moyen entre appel et changement de stage"] = null; // needs timestamps
  V["CA total des deals avec appels (€)"] = has(deals.caWonWithCalls) ? eur(deals.caWonWithCalls) : null;
  V["CA moyen par deal avec appels vs sans appels"] = has(deals.wonWithCalls) && has(deals.totalClosedWon)
    ? `${eur(deals.caWonWithCalls / deals.wonWithCalls)} avec · ${eur(deals.totalClosedWon > deals.wonWithCalls ? (deals.caClosedWon - deals.caWonWithCalls) / (deals.totalClosedWon - deals.wonWithCalls) : 0)} sans` : null;
  V["% des deals won ayant eu un appel"] = has(deals.totalClosedWon) ? pct(pctWonWithCall) : null;
  V["Top 5 commerciaux par CA influencé via appels"] = topCallOwner ? `Top: ${topCallOwner[0]} (${fmt(topCallOwner[1].count)} appels)` : null;

  // CONV INTEL
  V["Nb moyen de calls/meetings sur deals Won vs Lost"] = has(deals.totalClosedWon) && (has(deals.callsOnWonDeals) || has(deals.meetingsOnWonDeals))
    ? `${fmtDec((deals.callsOnWonDeals + deals.meetingsOnWonDeals) / deals.totalClosedWon)} gagnés · ${fmtDec((deals.callsOnLostDeals + deals.meetingsOnLostDeals) / Math.max(1, deals.totalClosedLost))} perdus` : null;
  V["Durée moyenne des calls sur deals Won"] = has(calls.total) ? `${fmtDec(avgCallDurationMin)} min` : null;
  V["Nb de notes logées (num_notes) sur deals gagnés"] = has(deals.dealsWithNotes) ? fmt(deals.dealsWithNotes) : null;
  V["Ratio emails envoyés / réponses reçues (hs_sales_email_last_replied)"] = has(emails.totalSent) ? pct(replyRate) : null;
  V["Nb moyen de meetings par deal Won vs Lost"] = has(deals.wonWithMeetings)
    ? `${fmtDec(avgMeetingsPerWonDeal)} gagnés · ${fmtDec(deals.meetingsOnLostDeals / Math.max(1, deals.totalClosedLost))} perdus` : null;
  V["CA moyen des deals avec 3+ meetings (€)"] = has(deals.dealsWonWith3PlusMeetings)
    ? eur(deals.caWonWith3PlusMeetings / deals.dealsWonWith3PlusMeetings) : null;
  V["Taux de conversion avec meeting vs sans"] = has(deals.wonWithMeetings) && has(deals.totalClosedWon)
    ? pct(deals.wonWithMeetings / Math.max(1, deals.dealsWithMeetings) * 100) : null;
  V["Top commerciaux par CA influencé via meetings"] = meetings.perOwner.size > 0
    ? `${meetings.perOwner.size} owners, ${fmt(meetings.totalCompleted)} meetings` : null;

  // ENRICHMENT / QUALITE DONNÉES
  V["Taux de conversion enrichi vs non-enrichi"] = null; // needs enrichment flag per contact
  V["CA moyen sur deals avec contacts enrichis (€)"] = null;
  V["Champs les plus impactants sur la conversion"] = null; // needs field-level correlation
  V["Nb total de doublons détectés"] = null; // needs duplicate detection
  V["% de doublons dans la base"] = null;
  V["Top 10 doublons par volume"] = null;
  V["Doublons avec des deals actifs associés"] = null;
  V["Nb de contacts sans company associée"] = has(contacts.total) ? fmt(contacts.withoutCompany) : null;
  V["Contacts orphelins avec deals actifs"] = null; // needs contact→deal association
  V["Lifecycle stage des contacts orphelins"] = contacts.lifecycleCounts.size > 0
    ? [...contacts.lifecycleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" · ") : null;
  V["Champs manquants les plus fréquents par owner"] = has(contacts.total)
    ? `Téléphone ${pct((1 - contacts.withPhone / contactTotal) * 100)} · Poste ${pct((1 - contacts.withJobtitle / contactTotal) * 100)} · Email ${pct((1 - contacts.withEmail / contactTotal) * 100)}` : null;
  V["Score de qualité moyen par portefeuille"] = has(contacts.total) ? pct(fieldCompleteness) : null;
  V["Nb de contacts à enrichir en priorité par owner"] = has(contacts.total) ? fmt(contacts.total - contacts.withPhone) : null;
  V["Champs les moins remplis (bottom 5)"] = has(contacts.total)
    ? `Téléphone ${pct(contacts.withPhone / contactTotal * 100)} · Poste ${pct(contacts.withJobtitle / contactTotal * 100)} · Email ${pct(contacts.withEmail / contactTotal * 100)}` : null;
  V["Complétude par lifecycle stage"] = null; // needs per-lifecycle completeness
  V["Évolution de la complétude mois par mois"] = null; // needs time-series
  V["Nb de deals sans contact associé"] = has(deals.total) ? fmt(deals.withoutContact) : null;
  V["Nb de deals sans company associée"] = has(deals.total) ? fmt(deals.withoutCompany) : null;
  V["Montant total des deals orphelins (€)"] = has(deals.orphanAmount) ? eur(deals.orphanAmount) : null;
  V["% de deals orphelins par pipeline"] = has(deals.total) ? pct(deals.orphans / deals.total * 100) : null;
  V["Nb de contacts avec lifecycle incohérent"] = null; // needs cross-referencing
  V["Types d'incohérences les plus fréquentes"] = null;
  V["Contacts 'Lead' avec deal Won"] = null; // needs contact→deal association
  V["Contacts 'Customer' sans deal Won"] = null;

  // MEETINGS
  V["Nb de meetings tenus par période"] = has(meetings.total) ? fmt(meetings.totalCompleted) : null;
  V["Taux de conversion meeting → deal créé"] = has(deals.dealsWithMeetings) && has(deals.total)
    ? pct(deals.dealsWithMeetings / meetings.total * 100) : null;
  V["Taux de show-up (meetings réalisés / planifiés)"] = has(meetings.total) ? pct(showUpRate) : null;
  V["Nb moyen de meetings par deal fermé"] = has(deals.totalMeetingsOnDeals) && has(totalClosed)
    ? fmtDec(deals.totalMeetingsOnDeals / totalClosed) : null;

  // EMAIL & CALENDAR
  V["Nb d'emails envoyés par owner / semaine"] = has(emails.totalSent) ? `${fmtDec(avgEmailsSentPerOwnerPerWeek)} par semaine` : null;
  V["Nb d'emails reçus (réponses) par owner"] = has(emails.totalReceived) ? fmt(avgEmailsReceivedPerOwner) : null;
  V["Taux de réponse par owner (%)"] = has(emails.totalSent) ? pct(replyRate) : null;
  V["Top 5 commerciaux les plus actifs par email"] = topEmailOwner ? `Top: ${topEmailOwner[0]} (${fmt(topEmailOwner[1].sent)})` : null;
  V["Nb moyen d'emails par deal"] = has(deals.dealsWithEmails) ? fmtDec(avgEmailsPerDeal) : null;
  V["Taux de réponse email par deal (hs_sales_email_last_replied)"] = has(emails.totalSent) ? pct(replyRate) : null;
  V["Durée du cycle pour deals avec réponse email rapide vs lente"] = null; // needs per-deal email timing
  V["Nb de touchpoints email avant Closed Won"] = has(deals.emailsOnWonDeals) && has(deals.totalClosedWon)
    ? fmtDec(deals.emailsOnWonDeals / deals.totalClosedWon) : null;

  // SOCIAL SELLING
  V["Taux de conversion social → deal"] = has(socialSource.total) ? pct(socialSource.won / socialSource.total * 100) : null;
  V["CA généré via contacts social (€)"] = has(socialSource.caWon) ? eur(socialSource.caWon) : null;
  V["CA total Closed Won source SOCIAL (€)"] = has(socialSource.caWon) ? eur(socialSource.caWon) : null;
  V["Nb de deals Won source SOCIAL"] = has(socialSource.total) ? fmt(socialSource.won) : null;
  V["Taille moyenne des deals SOCIAL vs autres sources"] = has(socialSource.won) ? eur(socialSource.caWon / socialSource.won) : null;
  V["Cycle moyen des deals SOCIAL (jours)"] = has(socialSource.daysCount) ? `${fmt(socialSource.totalDays / socialSource.daysCount)} j` : null;

  // SUPPORT / TICKETS
  V["Nb de tickets ouverts / fermés par période"] = has(tickets.total) ? `${fmt(tickets.open)} ouverts · ${fmt(tickets.closed)} fermés` : null;
  V["Nb de tickets ouverts / fermés par mois"] = has(tickets.total) ? `${fmt(tickets.open)} ouverts · ${fmt(tickets.closed)} fermés` : null;
  V["% de tickets haute priorité"] = has(tickets.total) ? pct(tickets.highPriority / tickets.total * 100) : null;
  V["Tickets haute priorité ouverts"] = has(tickets.total) ? fmt(tickets.highPriority) : null;
  V["Score CSAT proxy global (%)"] = has(tickets.total) ? pct(csatProxy) : null;
  V["Temps de première réponse moyen (h)"] = null; // needs ticket response timestamps
  V["Temps de résolution moyen (h)"] = null; // needs ticket close timestamps
  V["Taux de résolution au 1er contact (%)"] = has(tickets.closed) ? pct((tickets.closed - tickets.reopened) / tickets.closed * 100) : null;
  V["Temps moyen de résolution (jours)"] = null; // needs ticket timestamps
  V["Tickets par pipeline support"] = tickets.perPipeline.size > 0 ? [...tickets.perPipeline.entries()].map(([k, v]) => `${plName(k)} ${v}`).join(" · ") : null;
  V["Nb de tickets par canal"] = tickets.perChannel.size > 0 ? [...tickets.perChannel.entries()].map(([k, v]) => `${k} ${v}`).join(" · ") : null;
  V["Temps de résolution par canal (h)"] = null; // needs ticket timestamps
  V["Évolution du volume par canal (tendance)"] = null; // needs time-series
  V["Nb de tickets ouverts par company (30 derniers jours)"] = null; // needs ticket→company + date filter
  V["Tickets ouverts à 30j du renouvellement"] = null; // needs renewal dates
  V["MRR des comptes avec tickets critiques (€)"] = null; // needs ticket→company→subscription
  V["Score de risque churn par company"] = null; // needs churn model
  V["CSAT proxy par agent support"] = tickets.perOwner.size > 0
    ? `${tickets.perOwner.size} agents, résol. moy: ${pct(csatProxy)}` : null;
  V["Taux de réouverture de tickets (%)"] = has(tickets.total) ? pct(tickets.reopened / tickets.total * 100) : null;
  V["Évolution mensuelle du CSAT proxy"] = null; // needs time-series

  // ESIGN — needs external tool data
  V["Temps moyen envoi → signature (jours)"] = null;
  V["Taux de signature au 1er envoi"] = null;
  V["Nb de relances nécessaires avant signature"] = null;
  V["% du cycle total passé en phase signature"] = null;
  V["Nb de contrats non signés (>30j)"] = null;
  V["Montant total des contrats abandonnés (€)"] = null;
  V["Taux d'abandon par segment / taille de deal"] = null;
  V["Top commerciaux par taux d'abandon contrat"] = null;

  // BILLING — INVOICES
  V["Nb de factures émises par mois"] = has(invoices.count) ? fmt(invoices.count) : null;
  V["Montant total facturé (€)"] = has(invoices.totalBilled) ? eur(invoices.totalBilled) : null;
  V["Montant total encaissé (€)"] = has(invoices.totalPaid) ? eur(invoices.totalPaid) : null;
  V["Nb de factures en attente de paiement"] = has(invoices.count) ? fmt(invoices.pendingCount) : null;
  V["Montant total impayé (€)"] = has(invoices.pendingAmount) ? eur(invoices.pendingAmount) : null;
  V["CA forecast HubSpot vs facturé réel (€)"] = has(invoices.totalBilled) && has(deals.caClosedWon) ? `${eur(deals.caClosedWon)} vs ${eur(invoices.totalBilled)}` : null;
  V["Nb de deals Won sans facture associée"] = null; // needs deal→invoice mapping
  V["Écart moyen forecast vs facturé (%)"] = has(invoices.totalBilled) && has(deals.caClosedWon) ? pct(Math.abs(deals.caClosedWon - invoices.totalBilled) / deals.caClosedWon * 100) : null;
  V["Délai moyen Closed Won → 1re facture émise (jours)"] = null; // needs deal→invoice timestamps
  V["Ventilation par tranche d'ancienneté"] = null; // needs invoice aging
  V["Top 10 clients par encours"] = null; // needs per-client aggregation
  V["Nb de factures impayées > 90 jours"] = has(invoices.overdueCount) ? fmt(invoices.overdueCount) : null;

  // BILLING — SUBSCRIPTIONS
  V["MRR total actuel (€)"] = has(subscriptions.mrr) ? eur(subscriptions.mrr) : null;
  V["ARR extrapolé (€)"] = has(subscriptions.mrr) ? eur(subscriptions.arr) : null;
  V["MRR par plan / offre"] = null; // needs plan breakdown
  V["Évolution MRR mois par mois (%, €)"] = null; // needs time-series
  V["Churn MRR mensuel (€)"] = null; // needs subscription history
  V["Taux de churn gross (%)"] = has(subscriptions.totalCount) ? pct((subscriptions.totalCount - subscriptions.activeCount) / subscriptions.totalCount * 100) : null;
  V["Contraction MRR (downgrades, €)"] = null; // needs subscription history
  V["Net Revenue Retention (%)"] = null; // needs expansion + contraction
  V["Expansion MRR mensuel (€)"] = null;
  V["Nb de clients ayant upgradé"] = null;
  V["Revenu moyen par upgrade (€)"] = null;
  V["% de clients en expansion vs stables"] = null;

  // BILLING — PAYMENTS
  V["Nb de paiements réussis vs échoués"] = has(payments.total) ? `${fmt(payments.succeeded)} / ${fmt(payments.failed)}` : null;
  V["Taux de succès global (%)"] = has(payments.total) ? pct(payments.successRate) : null;
  V["Montant total en échec (€)"] = has(payments.totalFailedAmount) ? eur(payments.totalFailedAmount) : null;
  V["Taux de récupération après relance (dunning)"] = null; // needs dunning data

  // ADOPTION — needs usage tracking
  V["% d'adoption par outil et par user"] = null;
  V["Top 3 outils sous-utilisés"] = null;
  V["Users à former en priorité"] = null;
  V["Score d'adoption global de l'équipe"] = null;
  V["Adoption semaine N vs N-1 par outil"] = null;
  V["Outils en croissance d'adoption"] = null;
  V["Outils en déclin d'adoption"] = null;
  V["Taux d'adoption global (%)"] = null;
  V["Nb de connexions par user / semaine"] = null;
  V["Dernière connexion par user"] = null;
  V["Users inactifs depuis 7+ jours"] = null;
  V["Corrélation adoption CRM ↔ performance commerciale"] = null;

  // CYCLE DE VENTES
  V["Durée moyenne par étape (jours)"] = has(deals.timeInStageMs) ? `${fmtDec(deals.timeInStageMs / Math.max(1, deals.total) / 86_400_000)} j` : null;
  V["Étapes les plus lentes (>21 jours)"] = topStagnantStage ? `${stName(topStagnantStage[0])} (${fmt(topStagnantStage[1])} deals)` : null;
  V["Vélocité totale du pipeline (jours)"] = has(deals.avgDaysToClose) ? `${fmt(deals.avgDaysToClose)} j` : null;
  V["Comparaison par pipeline"] = deals.perPipeline.size > 1
    ? [...deals.perPipeline.entries()].map(([k, v]) => `${plName(k)} ${v.daysCount > 0 ? Math.round(v.totalDays / v.daysCount) : "?"} j`).join(" · ") : null;

  return V;
}
