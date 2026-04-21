/**
 * Shared data layer for the Audit > Service Client section.
 *
 * Fetches HubSpot tickets + ticket pipeline + computes service KPIs.
 *
 * Used by all 5 sub-pages :
 *   - /dashboard/audit/service-client (Vue d'ensemble)
 *   - /dashboard/audit/service-client/process
 *   - /dashboard/audit/service-client/churn
 *   - /dashboard/audit/service-client/cross-sell-upsell
 *   - /dashboard/audit/service-client/renouvellement
 */

export type TicketHS = {
  id: string;
  properties: {
    subject?: string;
    hs_pipeline?: string;
    hs_pipeline_stage?: string;
    hs_ticket_priority?: string;
    createdate?: string;
    closed_date?: string;
    hs_lastmodifieddate?: string;
    hs_time_to_first_response?: string;
    hs_time_to_close?: string;
    hubspot_owner_id?: string;
    source_type?: string;
  };
  associations?: { contacts?: { results?: Array<{ id: string }> } };
};

async function fetchAllTickets(token: string): Promise<TicketHS[]> {
  const all: TicketHS[] = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/tickets/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: [
            "subject", "hs_pipeline", "hs_pipeline_stage", "hs_ticket_priority",
            "createdate", "closed_date", "hs_lastmodifieddate",
            "hs_time_to_first_response", "hs_time_to_close",
            "hubspot_owner_id", "source_type",
          ],
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      all.push(...(data.results ?? []));
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 10);
  return all;
}

async function fetchTicketPipeline(
  token: string,
): Promise<{ closedStageIds: Set<string>; stagesById: Map<string, string> }> {
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/pipelines/tickets", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { closedStageIds: new Set(), stagesById: new Map() };
    const data = await res.json();
    const closedStages = new Set<string>();
    const stagesMap = new Map<string, string>();
    for (const p of (data.results ?? []) as Array<{
      stages?: Array<{ id: string; label: string; metadata?: { ticketState?: string } }>;
    }>) {
      for (const s of p.stages ?? []) {
        stagesMap.set(s.id, s.label);
        if (s.metadata?.ticketState === "CLOSED") closedStages.add(s.id);
      }
    }
    return { closedStageIds: closedStages, stagesById: stagesMap };
  } catch {
    return { closedStageIds: new Set(), stagesById: new Map() };
  }
}

export type ServiceClientData = {
  tickets: TicketHS[];
  closedStageIds: Set<string>;
  hasData: boolean;
  // Volume
  openTickets: number;
  closedTickets: number;
  urgentTickets: number;
  // Temps de traitement
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  csatProxy: number | null;
  ticketsPerCustomer: number | null;
  distinctContactsCount: number;
  // Score global
  score: number;
};

export async function fetchServiceClientData(token: string | null): Promise<ServiceClientData> {
  let tickets: TicketHS[] = [];
  let closedStageIds = new Set<string>();
  if (token) {
    [tickets, { closedStageIds }] = await Promise.all([
      fetchAllTickets(token),
      fetchTicketPipeline(token),
    ]);
  }

  const hasData = tickets.length > 0;
  const openTickets = tickets.filter((t) => !closedStageIds.has(t.properties.hs_pipeline_stage ?? "")).length;
  const closedTickets = tickets.length - openTickets;
  const urgentTickets = tickets.filter(
    (t) => t.properties.hs_ticket_priority === "HIGH" || t.properties.hs_ticket_priority === "URGENT",
  ).length;

  const firstResponseMs = tickets
    .map((t) => parseFloat(t.properties.hs_time_to_first_response ?? ""))
    .filter((n) => !isNaN(n) && n > 0);
  const avgFirstResponseHours = firstResponseMs.length > 0
    ? Math.round(firstResponseMs.reduce((a, b) => a + b, 0) / firstResponseMs.length / 3_600_000)
    : null;

  const timeToCloseMs = tickets
    .map((t) => parseFloat(t.properties.hs_time_to_close ?? ""))
    .filter((n) => !isNaN(n) && n > 0);
  const avgResolutionHours = timeToCloseMs.length > 0
    ? Math.round(timeToCloseMs.reduce((a, b) => a + b, 0) / timeToCloseMs.length / 3_600_000)
    : null;

  const resolvedFast = timeToCloseMs.filter((ms) => ms <= 24 * 3_600_000).length;
  const csatProxy = timeToCloseMs.length > 0
    ? Math.round((resolvedFast / timeToCloseMs.length) * 100)
    : null;

  const distinctContacts = new Set<string>();
  for (const t of tickets) {
    for (const c of t.associations?.contacts?.results ?? []) distinctContacts.add(c.id);
  }
  const ticketsPerCustomer = distinctContacts.size > 0
    ? Math.round((tickets.length / distinctContacts.size) * 10) / 10
    : null;

  const score = hasData
    ? Math.round(
        (csatProxy ?? 70) * 0.3 +
        (avgResolutionHours != null
          ? Math.min(100, Math.max(0, (1 - avgResolutionHours / 72) * 100))
          : 50) * 0.3 +
        (avgFirstResponseHours != null
          ? Math.min(100, Math.max(0, (1 - avgFirstResponseHours / 24) * 100))
          : 50) * 0.2 +
        (urgentTickets === 0 ? 100 : urgentTickets < 3 ? 60 : 20) * 0.2,
      )
    : 0;

  return {
    tickets, closedStageIds, hasData,
    openTickets, closedTickets, urgentTickets,
    avgFirstResponseHours, avgResolutionHours, csatProxy, ticketsPerCustomer,
    distinctContactsCount: distinctContacts.size, score,
  };
}

export const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
