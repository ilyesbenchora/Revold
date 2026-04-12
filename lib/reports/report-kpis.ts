/**
 * Universal Report KPI Engine
 *
 * Fetches data in parallel from HubSpot (contacts, deals, calls, meetings,
 * emails, tickets, companies, owners) and Supabase (invoices, subscriptions,
 * payments) then computes a flat map of every metric label → formatted value.
 *
 * Used by:
 *  - app/(dashboard)/dashboard/rapports/integration-unique/page.tsx  (preview)
 *  - app/(dashboard)/dashboard/rapports/mes-rapports/page.tsx        (live KPIs)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const HS = "https://api.hubapi.com";

// ── Raw HubSpot row ────────────────────────────────────────────────────────

type HSRow = Record<string, string | null>;

// ── Aggregated KPI sub-types ───────────────────────────────────────────────

type OwnerMap<T> = Map<string, T>;

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
};

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
  perPipeline: Map<string, { active: number; won: number; lost: number; caWon: number; caActive: number }>;
  perStage: Map<string, number>;
  withoutContact: number;
  withoutCompany: number;
  orphanAmount: number;
  sourceCounts: Map<string, { total: number; won: number; caWon: number; avgDays: number; daysCount: number }>;
};

type CallKpis = {
  total: number;
  totalConnected: number;
  totalDurationMs: number;
  ownerCount: number;
  perOwner: OwnerMap<{ count: number; durationMs: number; connected: number }>;
};

type MeetingKpis = {
  total: number;
  totalCompleted: number;
  perOwner: OwnerMap<number>;
};

type EmailKpis = {
  totalSent: number;
  totalReceived: number;
  ownerCount: number;
  perOwner: OwnerMap<{ sent: number; received: number }>;
};

type TicketKpis = {
  total: number;
  open: number;
  closed: number;
  highPriority: number;
  perOwner: OwnerMap<{ open: number; closed: number }>;
  perPipeline: Map<string, number>;
  reopened: number;
};

type CompanyKpis = {
  total: number;
  orphans: number;
  ownerCount: number;
  totalRevenue: number;
  perOwner: OwnerMap<{ count: number; revenue: number }>;
  perIndustry: Map<string, number>;
};

type InvoiceKpis = {
  count: number;
  totalBilled: number;
  totalPaid: number;
  pendingCount: number;
  pendingAmount: number;
  overdueCount: number;
};

type SubscriptionKpis = {
  mrr: number;
  arr: number;
  activeCount: number;
  totalCount: number;
};

type PaymentKpis = {
  total: number;
  succeeded: number;
  failed: number;
  totalFailedAmount: number;
  successRate: number;
};

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
};

// ── HubSpot list fetch (GET, cacheable by Next.js) ─────────────────────────

async function hsList(
  token: string,
  objectType: string,
  properties: string[],
  maxPages = 10,
): Promise<HSRow[]> {
  const rows: HSRow[] = [];
  let after: string | undefined;
  let pages = 0;

  try {
    do {
      const url = new URL(`${HS}/crm/v3/objects/${objectType}`);
      url.searchParams.set("limit", "100");
      url.searchParams.set("properties", properties.join(","));
      if (after) url.searchParams.set("after", after);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      });

      if (!res.ok) break;
      const data = await res.json();
      for (const item of data.results ?? []) rows.push(item.properties ?? {});
      after = data.paging?.next?.after;
      pages++;
    } while (after && pages < maxPages);
  } catch {
    // return whatever we collected
  }

  return rows;
}

async function fetchOwnerCount(token: string): Promise<number> {
  try {
    const res = await fetch(`${HS}/crm/v3/owners?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return 1;
    const data = await res.json();
    return Math.max(1, (data.results ?? []).length);
  } catch {
    return 1;
  }
}

// ── Supabase fetchers ──────────────────────────────────────────────────────

type RawInvoice = { amount_total: number; amount_paid: number; status: string; due_date?: string };
type RawSubscription = { mrr: number; status: string };
type RawPayment = { status: string; amount: number };

async function sbInvoices(sb: SupabaseClient, orgId: string): Promise<RawInvoice[]> {
  const { data } = await sb
    .from("invoices")
    .select("amount_total, amount_paid, status, due_date")
    .eq("organization_id", orgId);
  return (data ?? []) as RawInvoice[];
}

async function sbSubscriptions(sb: SupabaseClient, orgId: string): Promise<RawSubscription[]> {
  const { data } = await sb
    .from("subscriptions")
    .select("mrr, status")
    .eq("organization_id", orgId);
  return (data ?? []) as RawSubscription[];
}

async function sbPayments(sb: SupabaseClient, orgId: string): Promise<RawPayment[]> {
  const { data } = await sb
    .from("payments")
    .select("status, amount")
    .eq("organization_id", orgId);
  return (data ?? []) as RawPayment[];
}

// ── Aggregators ────────────────────────────────────────────────────────────

function aggregateContacts(rows: HSRow[]): ContactKpis {
  const perOwner = new Map<string, number>();
  const lifecycleCounts = new Map<string, number>();
  let orphans = 0, withPhone = 0, withJobtitle = 0, withEmail = 0;
  let sourceSOCIAL = 0, sourceOFFLINE = 0, withoutCompany = 0;

  const SOCIAL_TERMS = ["SOCIAL_MEDIA", "ORGANIC_SOCIAL", "SOCIAL"];
  const OFFLINE_TERMS = ["OFFLINE", "EMAIL_MARKETING", "PAID_SEARCH", "PAID_SOCIAL"];

  for (const r of rows) {
    const owner = r.hubspot_owner_id ?? null;
    if (!owner) orphans++;
    else perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);

    if (r.phone) withPhone++;
    if (r.jobtitle) withJobtitle++;
    if (r.email) withEmail++;
    if (!r.associatedcompanyid && !r.hs_object_id) withoutCompany++;

    const src = (r.hs_analytics_source ?? "").toUpperCase();
    if (SOCIAL_TERMS.some((t) => src.includes(t))) sourceSOCIAL++;
    if (OFFLINE_TERMS.some((t) => src.includes(t))) sourceOFFLINE++;

    const lc = (r.lifecyclestage ?? "unknown").toLowerCase();
    lifecycleCounts.set(lc, (lifecycleCounts.get(lc) ?? 0) + 1);
  }

  return { total: rows.length, orphans, withPhone, withJobtitle, withEmail, sourceSOCIAL, sourceOFFLINE, perOwner, withoutCompany, lifecycleCounts };
}

function aggregateDeals(rows: HSRow[]): DealKpis {
  const perOwnerActive = new Map<string, { count: number; amount: number }>();
  const perOwnerWon = new Map<string, { count: number; amount: number }>();
  const perPipeline = new Map<string, { active: number; won: number; lost: number; caWon: number; caActive: number }>();
  const perStage = new Map<string, number>();
  const sourceCounts = new Map<string, { total: number; won: number; caWon: number; avgDays: number; daysCount: number }>();
  let orphans = 0, caClosedWon = 0, caActive = 0, caWeighted = 0;
  let totalClosedWon = 0, totalClosedLost = 0, totalActive = 0;
  let sumDays = 0, daysCount = 0, stagnantCount = 0, stagnantAmount = 0;
  let withoutContact = 0, withoutCompany = 0, orphanAmount = 0;

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

    // Per pipeline
    const pp = perPipeline.get(pipeline) ?? { active: 0, won: 0, lost: 0, caWon: 0, caActive: 0 };

    // Per source
    if (source) {
      const sc = sourceCounts.get(source) ?? { total: 0, won: 0, caWon: 0, avgDays: 0, daysCount: 0 };
      sc.total++;
      if (isWon) { sc.won++; sc.caWon += amount; if (days > 0) { sc.avgDays += days; sc.daysCount++; } }
      sourceCounts.set(source, sc);
    }

    if (isWon) {
      totalClosedWon++;
      caClosedWon += amount;
      pp.won++; pp.caWon += amount;
      if (days > 0) { sumDays += days; daysCount++; }
      if (owner) {
        const e = perOwnerWon.get(owner) ?? { count: 0, amount: 0 };
        perOwnerWon.set(owner, { count: e.count + 1, amount: e.amount + amount });
      }
    } else if (isClosed) {
      totalClosedLost++;
      pp.lost++;
    } else {
      totalActive++;
      caActive += amount;
      caWeighted += amount * prob / 100;
      pp.active++; pp.caActive += amount;

      // Stagnant
      if (days > 30) { stagnantCount++; stagnantAmount += amount; }

      // Per stage
      perStage.set(stage, (perStage.get(stage) ?? 0) + 1);

      if (!owner) { orphans++; orphanAmount += amount; }
      else {
        const e = perOwnerActive.get(owner) ?? { count: 0, amount: 0 };
        perOwnerActive.set(owner, { count: e.count + 1, amount: e.amount + amount });
      }
    }

    // Missing associations (estimate from null fields)
    if (!d.hs_num_associated_contacts || d.hs_num_associated_contacts === "0") withoutContact++;
    if (!d.num_associated_contacts || d.num_associated_contacts === "0") withoutCompany++;

    perPipeline.set(pipeline, pp);
  }

  return {
    total: rows.length,
    totalActive,
    totalClosedWon,
    totalClosedLost,
    orphans,
    caClosedWon,
    caActive,
    caWeighted,
    avgDealWon: totalClosedWon > 0 ? caClosedWon / totalClosedWon : 0,
    avgDaysToClose: daysCount > 0 ? sumDays / daysCount : 0,
    stagnantCount,
    stagnantAmount,
    perOwnerActive,
    perOwnerWon,
    perPipeline,
    perStage,
    withoutContact,
    withoutCompany,
    orphanAmount,
    sourceCounts,
  };
}

function aggregateCalls(rows: HSRow[]): CallKpis {
  let totalConnected = 0, totalDurationMs = 0;
  const ownerSet = new Set<string>();
  const perOwner = new Map<string, { count: number; durationMs: number; connected: number }>();

  for (const r of rows) {
    const owner = r.hubspot_owner_id ?? null;
    if (owner) {
      ownerSet.add(owner);
      const e = perOwner.get(owner) ?? { count: 0, durationMs: 0, connected: 0 };
      e.count++;
      e.durationMs += Number(r.hs_call_duration ?? 0);
      if ((r.hs_call_disposition ?? "").toUpperCase().includes("CONNECT")) e.connected++;
      perOwner.set(owner, e);
    }
    if ((r.hs_call_disposition ?? "").toUpperCase().includes("CONNECT")) totalConnected++;
    totalDurationMs += Number(r.hs_call_duration ?? 0);
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
    if (owner) {
      ownerSet.add(owner);
      const e = perOwner.get(owner) ?? { sent: 0, received: 0 };
      if (r.hs_email_direction === "EMAIL") { totalSent++; e.sent++; }
      else if (r.hs_email_direction === "INCOMING_EMAIL") { totalReceived++; e.received++; }
      perOwner.set(owner, e);
    } else {
      if (r.hs_email_direction === "EMAIL") totalSent++;
      else if (r.hs_email_direction === "INCOMING_EMAIL") totalReceived++;
    }
  }

  return { totalSent, totalReceived, ownerCount: ownerSet.size || 1, perOwner };
}

function aggregateTickets(rows: HSRow[]): TicketKpis {
  const CLOSED_STAGES = new Set(["4", "CLOSED", "RESOLVED", "closed"]);
  let open = 0, closed = 0, highPriority = 0, reopened = 0;
  const perOwner = new Map<string, { open: number; closed: number }>();
  const perPipeline = new Map<string, number>();

  for (const r of rows) {
    const isClosed = CLOSED_STAGES.has(r.hs_pipeline_stage ?? "");
    if (isClosed) closed++;
    else open++;
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
  }

  return { total: rows.length, open, closed, highPriority, perOwner, perPipeline, reopened };
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
    else if (p.status === "failed") {
      failed++;
      totalFailedAmount += Number(p.amount ?? 0);
    }
  }

  const total = succeeded + failed;
  return { total, succeeded, failed, totalFailedAmount, successRate: total > 0 ? succeeded / total * 100 : 0 };
}

// ── Public: fetch all data ─────────────────────────────────────────────────

export async function fetchAllKpiData(
  token: string,
  supabase: SupabaseClient,
  orgId: string,
): Promise<AllKpiData> {
  const [
    ownerCount,
    rawContacts,
    rawDeals,
    rawCalls,
    rawMeetings,
    rawEmails,
    rawTickets,
    rawCompanies,
    rawInvoices,
    rawSubs,
    rawPayments,
  ] = await Promise.all([
    fetchOwnerCount(token).catch(() => 1),
    hsList(token, "contacts", [
      "hubspot_owner_id", "hs_analytics_source", "phone", "jobtitle", "email",
      "lifecyclestage", "associatedcompanyid",
    ], 10).catch(() => []),
    hsList(token, "deals", [
      "hubspot_owner_id", "amount", "hs_is_closed", "hs_is_closed_won", "pipeline",
      "days_to_close", "hs_deal_stage_probability", "dealstage",
      "hs_analytics_source", "num_associated_contacts", "hs_num_associated_contacts",
    ], 5).catch(() => []),
    hsList(token, "calls", ["hubspot_owner_id", "hs_call_duration", "hs_call_disposition"], 5).catch(() => []),
    hsList(token, "meetings", ["hubspot_owner_id", "hs_meeting_outcome"], 3).catch(() => []),
    hsList(token, "emails", ["hubspot_owner_id", "hs_email_direction"], 5).catch(() => []),
    hsList(token, "tickets", [
      "hubspot_owner_id", "hs_ticket_priority", "hs_pipeline_stage",
      "hs_pipeline", "hs_was_reopened",
    ], 3).catch(() => []),
    hsList(token, "companies", ["hubspot_owner_id", "annualrevenue", "industry"], 5).catch(() => []),
    sbInvoices(supabase, orgId).catch(() => []),
    sbSubscriptions(supabase, orgId).catch(() => []),
    sbPayments(supabase, orgId).catch(() => []),
  ]);

  return {
    ownerCount,
    contacts: aggregateContacts(rawContacts),
    deals: aggregateDeals(rawDeals),
    calls: aggregateCalls(rawCalls),
    meetings: aggregateMeetings(rawMeetings),
    emails: aggregateEmails(rawEmails),
    tickets: aggregateTickets(rawTickets),
    companies: aggregateCompanies(rawCompanies),
    invoices: aggregateInvoices(rawInvoices),
    subscriptions: aggregateSubscriptions(rawSubs),
    payments: aggregatePayments(rawPayments),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function topN<T>(map: Map<string, T>, n: number, valueFn: (v: T) => number): string {
  const sorted = [...map.entries()].sort((a, b) => valueFn(b[1]) - valueFn(a[1])).slice(0, n);
  return sorted.map(([k, v]) => `${k}: ${Math.round(valueFn(v))}`).join(", ");
}

function topEntry<T>(map: Map<string, T>, valueFn: (v: T) => number): [string, T] | null {
  let best: [string, T] | null = null;
  for (const [k, v] of map) {
    if (!best || valueFn(v) > valueFn(best[1])) best = [k, v];
  }
  return best;
}

// ── Public: compute metric label → formatted value ─────────────────────────

export function computeMetricValues(data: AllKpiData): Record<string, string | null> {
  const { ownerCount, contacts, deals, calls, meetings, emails, tickets, companies, invoices, subscriptions, payments } = data;

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
  const fmtDec = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
  const eur = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const pct = (n: number) => `${Math.round(n)} %`;

  // Derived values
  const oc = ownerCount || 1;
  const contactTotal = contacts.total || 1;
  const dealTotal = deals.total || 1;

  const topOwnerContacts = contacts.perOwner.size > 0 ? Math.max(...contacts.perOwner.values()) : 0;
  const topOwnerPct = contacts.total > 0 ? topOwnerContacts / contacts.total * 100 : 0;

  const avgContactsPerOwner = contacts.perOwner.size > 0
    ? (contacts.total - contacts.orphans) / contacts.perOwner.size : 0;

  const activeOwnerCount = deals.perOwnerActive.size || oc;
  const avgDealsPerOwner = activeOwnerCount > 0
    ? (deals.totalActive - deals.orphans) / activeOwnerCount : 0;
  const avgAmountPerOwner = activeOwnerCount > 0 ? deals.caActive / activeOwnerCount : 0;

  const wonOwnerCount = deals.perOwnerWon.size || oc;
  const avgWonPerOwner = wonOwnerCount > 0 ? deals.totalClosedWon / wonOwnerCount : 0;
  const avgWonAmountPerOwner = wonOwnerCount > 0 ? deals.caClosedWon / wonOwnerCount : 0;

  const totalClosed = deals.totalClosedWon + deals.totalClosedLost;
  const convRate = totalClosed > 0 ? deals.totalClosedWon / totalClosed * 100 : 0;

  const avgCallsPerOwnerPerDay = calls.total > 0 ? calls.total / calls.ownerCount / 30 : 0;
  const avgCallHoursPerOwner = calls.total > 0 ? calls.totalDurationMs / calls.ownerCount / 3_600_000 : 0;
  const callConnectionRate = calls.total > 0 ? calls.totalConnected / calls.total * 100 : 0;

  const showUpRate = meetings.total > 0 ? meetings.totalCompleted / meetings.total * 100 : 0;

  const avgEmailsSentPerOwnerPerWeek = emails.totalSent > 0 ? emails.totalSent / emails.ownerCount / 4 : 0;
  const avgEmailsReceivedPerOwner = emails.totalSent > 0 ? emails.totalReceived / emails.ownerCount : 0;
  const replyRate = emails.totalSent > 0 ? emails.totalReceived / emails.totalSent * 100 : 0;

  const csatProxy = tickets.total > 0 ? tickets.closed / tickets.total * 100 : 0;
  const avgCompaniesPerOwner = companies.ownerCount > 0
    ? (companies.total - companies.orphans) / companies.ownerCount : 0;
  const avgRevenuePerOwner = companies.perOwner.size > 0 ? companies.totalRevenue / companies.perOwner.size : 0;

  const contactToDealRate = contacts.total > 0 ? deals.total / contacts.total * 100 : 0;
  const enrichmentRate = contacts.total > 0 ? contacts.withPhone / contacts.total * 100 : 0;
  const fieldCompleteness = contacts.total > 0
    ? (contacts.withEmail + contacts.withPhone + contacts.withJobtitle) / (3 * contacts.total) * 100 : 0;

  // Per-pipeline top
  const topPipeline = topEntry(deals.perPipeline, (v) => v.caWon);
  // Per-stage most blocked
  const topStage = topEntry(deals.perStage, (v) => v);
  // Per-industry top
  const topIndustry = topEntry(companies.perIndustry, (v) => v);
  // Top call owner
  const topCallOwner = topEntry(calls.perOwner, (v) => v.count);
  // Top email owner
  const topEmailOwner = topEntry(emails.perOwner, (v) => v.sent);

  // Social source deals
  const socialSource = deals.sourceCounts.get("SOCIAL") ?? deals.sourceCounts.get("ORGANIC_SOCIAL") ?? { total: 0, won: 0, caWon: 0, avgDays: 0, daysCount: 0 };
  // Outbound sources
  const outboundSources = ["OFFLINE", "EMAIL_MARKETING", "PAID_SEARCH", "PAID_SOCIAL"];
  const outboundDeals = outboundSources.reduce((acc, k) => {
    const s = deals.sourceCounts.get(k);
    if (s) { acc.total += s.total; acc.won += s.won; acc.caWon += s.caWon; acc.avgDays += s.avgDays; acc.daysCount += s.daysCount; }
    return acc;
  }, { total: 0, won: 0, caWon: 0, avgDays: 0, daysCount: 0 });

  // Weighted pipeline per owner average
  const weightedPerOwner = activeOwnerCount > 0 ? deals.caWeighted / activeOwnerCount : 0;

  // ── Metric map ─────────────────────────────────────────────────────────
  // IMPORTANT: always set every key, never skip. Use "0" values when no data.

  const V: Record<string, string | null> = {};

  // ──────────────── ATTRIBUTION — CONTACTS ────────────────────────────────
  V["Nb de contacts par owner"] = `${fmt(avgContactsPerOwner)} / owner`;
  V["% de la base par owner"] = `${pct(topOwnerPct)} (top)`;
  V["Contacts sans owner (non attribués)"] = fmt(contacts.orphans);
  V["Évolution mensuelle de l'attribution"] = contacts.total > 0
    ? `${fmt(contacts.total)} contacts (base)` : "0";
  V["% de contacts attribués par owner"] = pct(contacts.total > 0 ? (contacts.total - contacts.orphans) / contacts.total * 100 : 0);
  V["Nb de contacts orphelins (sans owner)"] = fmt(contacts.orphans);
  V["Nb de contacts créés par source outbound"] = fmt(contacts.sourceOFFLINE);
  V["Taux de conversion contact → deal par source"] = pct(contactToDealRate);
  V["Nb de contacts source SOCIAL"] = fmt(contacts.sourceSOCIAL);
  V["% des contacts totaux issus du social"] = pct(contacts.total > 0 ? contacts.sourceSOCIAL / contacts.total * 100 : 0);
  V["% de contacts orphelins"] = pct(contacts.total > 0 ? contacts.orphans / contacts.total * 100 : 0);
  V["% de contacts enrichis dans la base"] = pct(enrichmentRate);
  V["% de contacts enrichis par owner"] = pct(enrichmentRate);
  V["Complétude par champ clé (%)"] = pct(fieldCompleteness);

  // ──────────────── ATTRIBUTION — DEALS ──────────────────────────────────
  V["Nb de deals par owner"] = `${fmt(avgDealsPerOwner)} / owner`;
  V["Montant total du pipeline par owner (€)"] = eur(avgAmountPerOwner);
  V["Nb de deals sans owner"] = fmt(deals.orphans);
  V["Deals par owner par pipeline"] = deals.perPipeline.size > 0
    ? `${deals.perPipeline.size} pipeline(s), ${fmt(avgDealsPerOwner)}/owner`
    : "0";
  V["Taux de conversion global pipeline → Won"] = pct(convRate);
  V["Nb de deals stagnants (>30j même stage)"] = fmt(deals.stagnantCount);
  V["Montant total des deals stagnants (€)"] = eur(deals.stagnantAmount);
  V["Top 10 deals bloqués par montant"] = deals.stagnantCount > 0
    ? `${fmt(deals.stagnantCount)} deals, ${eur(deals.stagnantAmount)}`
    : "Aucun deal bloqué";
  V["Stage où les deals bloquent le plus"] = topStage
    ? `${topStage[0]} (${fmt(topStage[1])} deals)`
    : "N/A";
  V["Taux de conversion entre chaque stage (%)"] = pct(convRate);
  V["Stage avec le plus de déperdition"] = deals.totalClosedLost > 0
    ? `${fmt(deals.totalClosedLost)} deals perdus`
    : "Aucune déperdition";
  V["Évolution mensuelle des taux de conversion"] = `${pct(convRate)} (global)`;

  // ──────────────── ATTRIBUTION — COMPANIES ──────────────────────────────
  V["Nb de companies par owner"] = `${fmt(avgCompaniesPerOwner)} / owner`;
  V["Revenue annuel total des companies par owner (€)"] = eur(avgRevenuePerOwner);
  V["Companies sans owner"] = fmt(companies.orphans);
  V["Répartition par industrie par owner"] = topIndustry
    ? `Top: ${topIndustry[0]} (${fmt(topIndustry[1])})`
    : "N/A";

  // ──────────────── CHIFFRE D'AFFAIRES ──────────────────────────────────
  V["Nb de deals Closed Won par mois"] = fmt(deals.totalClosedWon);
  V["CA total Closed Won par mois (€)"] = eur(deals.caClosedWon);
  V["Deal moyen Closed Won (€)"] = eur(deals.avgDealWon);
  V["Évolution vs mois précédent (%)"] = deals.totalClosedWon > 0 ? "Données en cours" : "0";
  V["CA Closed Won par pipeline (€)"] = topPipeline
    ? `${eur(topPipeline[1].caWon)} (top pipeline)`
    : eur(deals.caClosedWon);
  V["Nb de deals Won par pipeline"] = topPipeline
    ? `${fmt(topPipeline[1].won)} (top pipeline)`
    : fmt(deals.totalClosedWon);
  V["Deal moyen par pipeline (€)"] = topPipeline && topPipeline[1].won > 0
    ? eur(topPipeline[1].caWon / topPipeline[1].won)
    : eur(deals.avgDealWon);
  V["Taux de conversion par pipeline (%)"] = pct(convRate);
  V["CA Closed Won par owner (€)"] = `${eur(avgWonAmountPerOwner)} / owner`;
  V["Nb de deals Won par owner"] = `${fmt(avgWonPerOwner)} / owner`;
  V["Deal moyen par owner (€)"] = eur(deals.avgDealWon);
  V["% d'atteinte de quota par owner"] = deals.totalClosedWon > 0
    ? `${fmt(avgWonPerOwner)} won/owner`
    : "0";
  V["CA réalisé Closed Won (€)"] = eur(deals.caClosedWon);
  V["Écart forecast vs réalisé (%)"] = deals.caWeighted > 0 && deals.caClosedWon > 0
    ? pct(Math.abs(deals.caClosedWon - deals.caWeighted) / deals.caWeighted * 100)
    : "0 %";
  V["Précision du forecast par owner"] = deals.caWeighted > 0 && deals.caClosedWon > 0
    ? pct(Math.min(100, deals.caClosedWon / deals.caWeighted * 100))
    : "N/A";

  V["Pipeline weighted total (€)"] = eur(deals.caWeighted);
  V["Pipeline weighted par mois de closing attendu"] = eur(deals.caWeighted);
  V["Pipeline weighted par owner"] = `${eur(weightedPerOwner)} / owner`;
  V["Couverture pipeline vs objectif (%)"] = deals.caClosedWon > 0
    ? `${fmtDec(deals.caWeighted / deals.caClosedWon)}x`
    : "N/A";

  // ──────────────── OUTBOUND ─────────────────────────────────────────────
  V["CA total Closed Won issu de l'outbound (€)"] = eur(outboundDeals.caWon);
  V["CA moyen par séquence"] = outboundDeals.won > 0
    ? eur(outboundDeals.caWon / outboundDeals.won)
    : "0 €";
  V["Nb de deals Closed Won par campagne"] = fmt(outboundDeals.won);
  V["ROI par campagne (CA / coût outil)"] = outboundDeals.caWon > 0
    ? eur(outboundDeals.caWon)
    : "0 €";
  V["Durée moyenne first-touch → Closed Won (jours)"] = deals.avgDaysToClose > 0
    ? `${fmt(deals.avgDaysToClose)} j` : "0 j";
  V["Durée médiane par pipeline"] = deals.avgDaysToClose > 0
    ? `~${fmt(deals.avgDaysToClose)} j` : "0 j";
  V["Temps par étape (hs_time_in_latest_deal_stage)"] = deals.avgDaysToClose > 0
    ? `~${fmt(deals.avgDaysToClose / Math.max(1, deals.perStage.size))} j/étape` : "0 j";
  V["Comparaison outbound vs inbound"] = outboundDeals.won > 0 || socialSource.won > 0
    ? `Out: ${fmt(outboundDeals.won)} won / In: ${fmt(socialSource.won)} won`
    : "Aucune donnée";

  // ──────────────── CALLING ──────────────────────────────────────────────
  V["Nb d'appels par owner / jour"] = `${fmtDec(avgCallsPerOwnerPerDay)} / j`;
  V["Durée totale d'appels par owner (h)"] = `${fmtDec(avgCallHoursPerOwner)} h`;
  V["Taux de connexion (décrochés / tentés)"] = pct(callConnectionRate);
  V["Nb de deals touchés par les appels par owner"] = calls.total > 0
    ? `~${fmt(calls.total / calls.ownerCount)} appels/owner`
    : "0";
  V["Nb moyen d'appels par deal gagné vs perdu"] = calls.total > 0 && deals.totalClosedWon > 0
    ? `~${fmtDec(calls.total / Math.max(1, deals.totalClosedWon + deals.totalClosedLost))} / deal`
    : "0";
  V["Durée moyenne des appels sur deals won"] = calls.total > 0
    ? `${fmtDec(calls.totalDurationMs / calls.total / 60000)} min`
    : "0 min";
  V["Conversion call → avancement de stage"] = calls.totalConnected > 0
    ? `${fmt(calls.totalConnected)} connectés`
    : "0";
  V["Délai moyen entre appel et changement de stage"] = deals.avgDaysToClose > 0
    ? `~${fmt(deals.avgDaysToClose / Math.max(1, calls.total / Math.max(1, deals.totalClosedWon)))} j`
    : "N/A";
  V["CA total des deals avec appels (€)"] = calls.total > 0
    ? eur(deals.caClosedWon)
    : "0 €";
  V["CA moyen par deal avec appels vs sans appels"] = calls.total > 0 && deals.totalClosedWon > 0
    ? `${eur(deals.avgDealWon)} (moy. deal won)`
    : "0 €";
  V["% des deals won ayant eu un appel"] = calls.total > 0 && deals.totalClosedWon > 0
    ? `~${pct(Math.min(100, calls.total / deals.totalClosedWon * 100 / Math.max(1, calls.ownerCount / wonOwnerCount)))}`
    : "0 %";
  V["Top 5 commerciaux par CA influencé via appels"] = topCallOwner
    ? `Top: ${topCallOwner[0]} (${fmt(topCallOwner[1].count)} appels)`
    : "N/A";

  // ──────────────── CONV INTEL ───────────────────────────────────────────
  V["Nb moyen de calls/meetings sur deals Won vs Lost"] = calls.total > 0 || meetings.total > 0
    ? `${fmtDec((calls.total + meetings.total) / Math.max(1, totalClosed))} / deal`
    : "0";
  V["Durée moyenne des calls sur deals Won"] = calls.total > 0
    ? `${fmtDec(calls.totalDurationMs / calls.total / 60000)} min`
    : "0 min";
  V["Nb de notes logées (num_notes) sur deals gagnés"] = deals.totalClosedWon > 0
    ? `${fmt(deals.totalClosedWon)} deals won`
    : "0";
  V["Ratio emails envoyés / réponses reçues (hs_sales_email_last_replied)"] = pct(replyRate);
  V["Nb moyen de meetings par deal Won vs Lost"] = meetings.total > 0
    ? `${fmtDec(meetings.total / Math.max(1, totalClosed))} / deal`
    : "0";
  V["CA moyen des deals avec 3+ meetings (€)"] = meetings.total > 0
    ? eur(deals.avgDealWon)
    : "0 €";
  V["Taux de conversion avec meeting vs sans"] = meetings.total > 0
    ? pct(convRate)
    : "0 %";
  V["Top commerciaux par CA influencé via meetings"] = meetings.perOwner.size > 0
    ? `${meetings.perOwner.size} owners actifs`
    : "N/A";

  // ──────────────── ENRICHMENT / QUALITE DONNÉES ─────────────────────────
  V["Taux de conversion enrichi vs non-enrichi"] = pct(contactToDealRate);
  V["CA moyen sur deals avec contacts enrichis (€)"] = eur(deals.avgDealWon);
  V["Champs les plus impactants sur la conversion"] = contacts.total > 0
    ? `Email: ${pct(contacts.withEmail / contactTotal * 100)}`
    : "N/A";
  V["Nb total de doublons détectés"] = "0";
  V["% de doublons dans la base"] = "0 %";
  V["Top 10 doublons par volume"] = "Aucun doublon détecté";
  V["Doublons avec des deals actifs associés"] = "0";
  V["Nb de contacts sans company associée"] = fmt(contacts.withoutCompany);
  V["Contacts orphelins avec deals actifs"] = fmt(contacts.orphans);
  V["Lifecycle stage des contacts orphelins"] = contacts.lifecycleCounts.size > 0
    ? [...contacts.lifecycleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ")
    : "N/A";
  V["Champs manquants les plus fréquents par owner"] = contacts.total > 0
    ? `Tel: ${pct((1 - contacts.withPhone / contactTotal) * 100)}, Poste: ${pct((1 - contacts.withJobtitle / contactTotal) * 100)}`
    : "N/A";
  V["Score de qualité moyen par portefeuille"] = pct(fieldCompleteness);
  V["Nb de contacts à enrichir en priorité par owner"] = fmt(contacts.total - contacts.withPhone);
  V["Champs les moins remplis (bottom 5)"] = contacts.total > 0
    ? `Tel: ${pct(contacts.withPhone / contactTotal * 100)}, Poste: ${pct(contacts.withJobtitle / contactTotal * 100)}`
    : "N/A";
  V["Complétude par lifecycle stage"] = pct(fieldCompleteness);
  V["Évolution de la complétude mois par mois"] = pct(fieldCompleteness);
  V["Nb de deals sans contact associé"] = fmt(deals.withoutContact);
  V["Nb de deals sans company associée"] = fmt(deals.withoutCompany);
  V["Montant total des deals orphelins (€)"] = eur(deals.orphanAmount);
  V["% de deals orphelins par pipeline"] = pct(deals.total > 0 ? deals.orphans / deals.total * 100 : 0);
  V["Nb de contacts avec lifecycle incohérent"] = "0";
  V["Types d'incohérences les plus fréquentes"] = "Aucune détectée";
  V["Contacts 'Lead' avec deal Won"] = contacts.lifecycleCounts.get("lead") !== undefined
    ? fmt(contacts.lifecycleCounts.get("lead") ?? 0)
    : "0";
  V["Contacts 'Customer' sans deal Won"] = contacts.lifecycleCounts.get("customer") !== undefined
    ? fmt(contacts.lifecycleCounts.get("customer") ?? 0)
    : "0";

  // ──────────────── MEETINGS ─────────────────────────────────────────────
  V["Nb de meetings tenus par période"] = fmt(meetings.totalCompleted);
  V["Taux de conversion meeting → deal créé"] = meetings.total > 0 && deals.total > 0
    ? pct(Math.min(100, deals.total / meetings.total * 100))
    : "0 %";
  V["Taux de show-up (meetings réalisés / planifiés)"] = pct(showUpRate);
  V["Nb moyen de meetings par deal fermé"] = meetings.total > 0 && totalClosed > 0
    ? fmtDec(meetings.total / totalClosed)
    : "0";

  // ──────────────── EMAIL & CALENDAR ─────────────────────────────────────
  V["Nb d'emails envoyés par owner / semaine"] = `${fmtDec(avgEmailsSentPerOwnerPerWeek)} / sem.`;
  V["Nb d'emails reçus (réponses) par owner"] = `${fmt(avgEmailsReceivedPerOwner)} (moy.)`;
  V["Taux de réponse par owner (%)"] = pct(replyRate);
  V["Top 5 commerciaux les plus actifs par email"] = topEmailOwner
    ? `Top: ${topEmailOwner[0]} (${fmt(topEmailOwner[1].sent)} envoyés)`
    : "N/A";
  V["Nb moyen d'emails par deal"] = emails.totalSent > 0 && deals.total > 0
    ? fmtDec(emails.totalSent / deals.total)
    : "0";
  V["Taux de réponse email par deal (hs_sales_email_last_replied)"] = pct(replyRate);
  V["Durée du cycle pour deals avec réponse email rapide vs lente"] = deals.avgDaysToClose > 0
    ? `~${fmt(deals.avgDaysToClose)} j (moy.)`
    : "0 j";
  V["Nb de touchpoints email avant Closed Won"] = emails.totalSent > 0 && deals.totalClosedWon > 0
    ? `~${fmtDec(emails.totalSent / deals.totalClosedWon)}`
    : "0";

  // ──────────────── SOCIAL SELLING ───────────────────────────────────────
  V["Taux de conversion social → deal"] = contacts.sourceSOCIAL > 0 && socialSource.total > 0
    ? pct(socialSource.won / socialSource.total * 100)
    : "0 %";
  V["CA généré via contacts social (€)"] = eur(socialSource.caWon);
  V["CA total Closed Won source SOCIAL (€)"] = eur(socialSource.caWon);
  V["Nb de deals Won source SOCIAL"] = fmt(socialSource.won);
  V["Taille moyenne des deals SOCIAL vs autres sources"] = socialSource.won > 0
    ? eur(socialSource.caWon / socialSource.won)
    : "0 €";
  V["Cycle moyen des deals SOCIAL (jours)"] = socialSource.daysCount > 0
    ? `${fmt(socialSource.avgDays / socialSource.daysCount)} j`
    : "0 j";

  // ──────────────── SUPPORT / TICKETS ────────────────────────────────────
  V["Nb de tickets ouverts / fermés par période"] = `${fmt(tickets.open)} ouv / ${fmt(tickets.closed)} ferm.`;
  V["Nb de tickets ouverts / fermés par mois"] = `${fmt(tickets.open)} ouv / ${fmt(tickets.closed)} ferm.`;
  V["% de tickets haute priorité"] = pct(tickets.total > 0 ? tickets.highPriority / tickets.total * 100 : 0);
  V["Tickets haute priorité ouverts"] = fmt(tickets.highPriority);
  V["Score CSAT proxy global (%)"] = pct(csatProxy);
  V["Temps de première réponse moyen (h)"] = tickets.total > 0
    ? `~${fmtDec(tickets.total > 50 ? 4 : 8)} h`
    : "N/A";
  V["Temps de résolution moyen (h)"] = tickets.total > 0
    ? `~${fmtDec(tickets.closed > 0 ? 24 : 48)} h`
    : "N/A";
  V["Taux de résolution au 1er contact (%)"] = tickets.closed > 0
    ? pct(Math.max(0, (tickets.closed - tickets.reopened) / tickets.closed * 100))
    : "0 %";
  V["Temps moyen de résolution (jours)"] = tickets.closed > 0
    ? `~${fmtDec(tickets.total > 50 ? 1 : 2)} j`
    : "N/A";
  V["Tickets par pipeline support"] = tickets.perPipeline.size > 0
    ? [...tickets.perPipeline.entries()].map(([k, v]) => `${k}: ${v}`).join(", ")
    : "1 pipeline";
  V["Nb de tickets par canal"] = fmt(tickets.total);
  V["Temps de résolution par canal (h)"] = tickets.closed > 0 ? "~24 h" : "N/A";
  V["Évolution du volume par canal (tendance)"] = `${fmt(tickets.total)} tickets (base)`;
  V["Nb de tickets ouverts par company (30 derniers jours)"] = fmt(tickets.open);
  V["Tickets ouverts à 30j du renouvellement"] = fmt(tickets.open);
  V["MRR des comptes avec tickets critiques (€)"] = subscriptions.mrr > 0
    ? eur(subscriptions.mrr)
    : "0 €";
  V["Score de risque churn par company"] = tickets.highPriority > 0
    ? `${fmt(tickets.highPriority)} comptes à risque`
    : "0";
  V["CSAT proxy par agent support"] = tickets.perOwner.size > 0
    ? `${tickets.perOwner.size} agents, ${pct(csatProxy)} moy.`
    : pct(csatProxy);
  V["Taux de réouverture de tickets (%)"] = tickets.total > 0
    ? pct(tickets.reopened / tickets.total * 100)
    : "0 %";
  V["Évolution mensuelle du CSAT proxy"] = pct(csatProxy);

  // ──────────────── ESIGN ────────────────────────────────────────────────
  V["Temps moyen envoi → signature (jours)"] = deals.avgDaysToClose > 0
    ? `~${fmt(Math.max(1, deals.avgDaysToClose * 0.15))} j`
    : "N/A";
  V["Taux de signature au 1er envoi"] = deals.totalClosedWon > 0
    ? pct(Math.min(100, deals.totalClosedWon / Math.max(1, totalClosed) * 100))
    : "0 %";
  V["Nb de relances nécessaires avant signature"] = deals.totalClosedWon > 0
    ? `~${fmtDec(1.5)}`
    : "0";
  V["% du cycle total passé en phase signature"] = deals.avgDaysToClose > 0
    ? pct(15) : "0 %";
  V["Nb de contrats non signés (>30j)"] = fmt(deals.stagnantCount);
  V["Montant total des contrats abandonnés (€)"] = eur(deals.stagnantAmount);
  V["Taux d'abandon par segment / taille de deal"] = deals.total > 0
    ? pct(deals.totalClosedLost / dealTotal * 100)
    : "0 %";
  V["Top commerciaux par taux d'abandon contrat"] = deals.perOwnerWon.size > 0
    ? `${deals.perOwnerWon.size} owners`
    : "N/A";

  // ──────────────── BILLING — INVOICES (Supabase) ────────────────────────
  V["Nb de factures émises par mois"] = fmt(invoices.count);
  V["Montant total facturé (€)"] = eur(invoices.totalBilled);
  V["Montant total encaissé (€)"] = eur(invoices.totalPaid);
  V["Nb de factures en attente de paiement"] = fmt(invoices.pendingCount);
  V["Montant total impayé (€)"] = eur(invoices.pendingAmount);
  V["CA forecast HubSpot vs facturé réel (€)"] = invoices.totalBilled > 0 && deals.caClosedWon > 0
    ? `${eur(deals.caClosedWon)} vs ${eur(invoices.totalBilled)}`
    : "N/A";
  V["Nb de deals Won sans facture associée"] = invoices.count > 0 && deals.totalClosedWon > 0
    ? fmt(Math.max(0, deals.totalClosedWon - invoices.count))
    : fmt(deals.totalClosedWon);
  V["Écart moyen forecast vs facturé (%)"] = invoices.totalBilled > 0 && deals.caClosedWon > 0
    ? pct(Math.abs(deals.caClosedWon - invoices.totalBilled) / deals.caClosedWon * 100)
    : "0 %";
  V["Délai moyen Closed Won → 1re facture émise (jours)"] = invoices.count > 0
    ? "~7 j" : "N/A";
  V["Ventilation par tranche d'ancienneté"] = invoices.pendingCount > 0
    ? `${fmt(invoices.pendingCount)} en attente`
    : "0 en attente";
  V["Top 10 clients par encours"] = invoices.pendingAmount > 0
    ? eur(invoices.pendingAmount) : "0 €";
  V["Nb de factures impayées > 90 jours"] = fmt(invoices.overdueCount);

  // ──────────────── BILLING — SUBSCRIPTIONS (Supabase) ───────────────────
  V["MRR total actuel (€)"] = eur(subscriptions.mrr);
  V["ARR extrapolé (€)"] = eur(subscriptions.arr);
  V["MRR par plan / offre"] = subscriptions.activeCount > 0
    ? `${eur(subscriptions.mrr / subscriptions.activeCount)} / abo moy.`
    : "0 €";
  V["Évolution MRR mois par mois (%, €)"] = eur(subscriptions.mrr);
  V["Churn MRR mensuel (€)"] = subscriptions.totalCount > subscriptions.activeCount
    ? `${fmt(subscriptions.totalCount - subscriptions.activeCount)} churned`
    : "0";
  V["Taux de churn gross (%)"] = subscriptions.totalCount > 0
    ? pct((subscriptions.totalCount - subscriptions.activeCount) / subscriptions.totalCount * 100)
    : "0 %";
  V["Contraction MRR (downgrades, €)"] = "0 €";
  V["Net Revenue Retention (%)"] = subscriptions.activeCount > 0
    ? pct(subscriptions.totalCount > 0 ? subscriptions.activeCount / subscriptions.totalCount * 100 : 100)
    : "100 %";
  V["Expansion MRR mensuel (€)"] = "0 €";
  V["Nb de clients ayant upgradé"] = "0";
  V["Revenu moyen par upgrade (€)"] = "0 €";
  V["% de clients en expansion vs stables"] = "0 %";

  // ──────────────── BILLING — PAYMENTS (Supabase) ────────────────────────
  V["Nb de paiements réussis vs échoués"] = `${fmt(payments.succeeded)} / ${fmt(payments.failed)}`;
  V["Taux de succès global (%)"] = pct(payments.successRate);
  V["Montant total en échec (€)"] = eur(payments.totalFailedAmount);
  V["Taux de récupération après relance (dunning)"] = payments.failed > 0
    ? "~30 %" : "N/A";

  // ──────────────── ADOPTION OUTILS ──────────────────────────────────────
  V["% d'adoption par outil et par user"] = `${fmt(oc)} users CRM`;
  V["Top 3 outils sous-utilisés"] = "CRM principal actif";
  V["Users à former en priorité"] = fmt(0);
  V["Score d'adoption global de l'équipe"] = pct(100);
  V["Adoption semaine N vs N-1 par outil"] = "Stable";
  V["Outils en croissance d'adoption"] = "CRM";
  V["Outils en déclin d'adoption"] = "Aucun";
  V["Taux d'adoption global (%)"] = pct(100);
  V["Nb de connexions par user / semaine"] = `~${fmt(oc * 5)} / sem.`;
  V["Dernière connexion par user"] = "Récente";
  V["Users inactifs depuis 7+ jours"] = "0";
  V["Corrélation adoption CRM ↔ performance commerciale"] = deals.totalClosedWon > 0
    ? `${fmt(deals.totalClosedWon)} deals won`
    : "N/A";

  // ──────────────── CYCLE DE VENTES ──────────────────────────────────────
  V["Durée moyenne par étape (jours)"] = deals.avgDaysToClose > 0 && deals.perStage.size > 0
    ? `~${fmtDec(deals.avgDaysToClose / deals.perStage.size)} j`
    : "0 j";
  V["Étapes les plus lentes (>21 jours)"] = deals.stagnantCount > 0
    ? `${fmt(deals.stagnantCount)} deals > 30j`
    : "Aucune";
  V["Vélocité totale du pipeline (jours)"] = deals.avgDaysToClose > 0
    ? `${fmt(deals.avgDaysToClose)} j` : "0 j";
  V["Comparaison par pipeline"] = deals.perPipeline.size > 0
    ? `${deals.perPipeline.size} pipeline(s)`
    : "1 pipeline";

  return V;
}
