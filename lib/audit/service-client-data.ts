import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared data layer for the Audit > Service Client section.
 *
 * Lit le MIROIR Supabase (table tickets, synchronisée par l'ETL toutes les
 * 30 min) — aucun appel HubSpot live : plus de « 0 partout » intermittent dû
 * aux timeouts/429, et couverture de TOUS les tickets du portail (l'ancien
 * fetch live plafonnait à 1 000).
 *
 * Propriétés SLA : les noms réels côté portail sont `time_to_first_agent_reply`
 * et `time_to_close` (ms) — les variantes hs_time_to_first_response /
 * hs_time_to_close n'existent pas. Repli sur les colonnes canoniques
 * (first_response_at / resolved_at − opened_at) pour les sources non-HubSpot.
 *
 * Used by the Service Client pages :
 *   - /dashboard/audit/service-client (Vue d'ensemble)
 *   - /dashboard/audit/service-client/process
 *   - /dashboard/audit/service-client/cross-sell-upsell
 *   - /dashboard/audit/service-client/renouvellement
 */

export type TicketHS = {
  id: string;
  properties: {
    subject?: string | null;
    hs_pipeline?: string | null;
    hs_pipeline_stage?: string | null;
    hs_ticket_priority?: string | null;
    createdate?: string | null;
    closed_date?: string | null;
    hs_lastmodifieddate?: string | null;
    time_to_first_agent_reply?: string | null;
    time_to_close?: string | null;
    first_agent_reply_date?: string | null;
    hubspot_owner_id?: string | null;
    source_type?: string | null;
    hs_last_csat_rating?: string | null;
    hs_feedback_last_nps_rating_number?: string | null;
  };
  /** Statut canonique du miroir — dérivé de closed_date à la sync. */
  status: "open" | "closed";
  contactId: string | null;
};

type TicketRow = {
  id: string;
  status: string | null;
  priority: string | null;
  subject: string | null;
  channel: string | null;
  opened_at: string | null;
  resolved_at: string | null;
  first_response_at: string | null;
  contact_id: string | null;
  raw_data: { properties?: Record<string, string | null> } | null;
};

async function fetchAllTicketRows(supabase: SupabaseClient, orgId: string): Promise<TicketRow[]> {
  const PAGE = 1000;
  const all: TicketRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("tickets")
      .select("id, status, priority, subject, channel, opened_at, resolved_at, first_response_at, contact_id, raw_data")
      .eq("organization_id", orgId)
      .order("opened_at", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as TicketRow[]));
    if (data.length < PAGE) break;
  }
  return all;
}

function toTicketHS(row: TicketRow): TicketHS {
  const props = row.raw_data?.properties ?? {};
  return {
    id: row.id,
    properties: {
      ...props,
      // Repli colonnes canoniques pour les sources dont raw_data diffère.
      subject: props.subject ?? row.subject,
      createdate: props.createdate ?? row.opened_at,
      closed_date: props.closed_date ?? props.hs_lastclosedate ?? row.resolved_at,
      first_agent_reply_date: props.first_agent_reply_date ?? row.first_response_at,
      hs_ticket_priority: props.hs_ticket_priority ?? row.priority,
      source_type: props.source_type ?? row.channel,
    },
    status: row.status === "closed" ? "closed" : "open",
    contactId: row.contact_id,
  };
}

/** Durée en ms : propriété HubSpot (ms) prioritaire, sinon écart entre dates. */
function durationMs(prop: string | null | undefined, from: string | null | undefined, to: string | null | undefined): number | null {
  const n = parseFloat(prop ?? "");
  if (!isNaN(n) && n > 0) return n;
  if (from && to) {
    const d = new Date(to).getTime() - new Date(from).getTime();
    if (!isNaN(d) && d > 0) return d;
  }
  return null;
}

/** Délai de 1ère réponse d'un ticket en ms (propriété HubSpot ou écart de dates). */
export function firstResponseMsOf(t: TicketHS): number | null {
  return durationMs(t.properties.time_to_first_agent_reply, t.properties.createdate, t.properties.first_agent_reply_date);
}

export type ServiceClientData = {
  tickets: TicketHS[];
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

export async function fetchServiceClientData(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ServiceClientData> {
  const rows = await fetchAllTicketRows(supabase, orgId);
  const tickets = rows.map(toTicketHS);

  const hasData = tickets.length > 0;
  const closedTickets = tickets.filter((t) => t.status === "closed").length;
  const openTickets = tickets.length - closedTickets;
  const urgentTickets = tickets.filter((t) => {
    const p = (t.properties.hs_ticket_priority ?? "").toUpperCase();
    return p === "HIGH" || p === "URGENT";
  }).length;

  const firstResponseMs = tickets
    .map((t) => durationMs(t.properties.time_to_first_agent_reply, t.properties.createdate, t.properties.first_agent_reply_date))
    .filter((n): n is number => n != null);
  const avgFirstResponseHours = firstResponseMs.length > 0
    ? Math.round(firstResponseMs.reduce((a, b) => a + b, 0) / firstResponseMs.length / 3_600_000)
    : null;

  const timeToCloseMs = tickets
    .map((t) => durationMs(t.properties.time_to_close, t.properties.createdate, t.properties.closed_date))
    .filter((n): n is number => n != null);
  const avgResolutionHours = timeToCloseMs.length > 0
    ? Math.round(timeToCloseMs.reduce((a, b) => a + b, 0) / timeToCloseMs.length / 3_600_000)
    : null;

  const resolvedFast = timeToCloseMs.filter((ms) => ms <= 24 * 3_600_000).length;
  const csatProxy = timeToCloseMs.length > 0
    ? Math.round((resolvedFast / timeToCloseMs.length) * 100)
    : null;

  const distinctContacts = new Set<string>();
  for (const t of tickets) if (t.contactId) distinctContacts.add(t.contactId);
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
    tickets, hasData,
    openTickets, closedTickets, urgentTickets,
    avgFirstResponseHours, avgResolutionHours, csatProxy, ticketsPerCustomer,
    distinctContactsCount: distinctContacts.size, score,
  };
}

export const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
