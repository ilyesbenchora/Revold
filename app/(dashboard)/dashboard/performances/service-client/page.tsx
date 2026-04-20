export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

type TicketHS = {
  id: string;
  properties: {
    subject?: string;
    hs_pipeline?: string;
    hs_pipeline_stage?: string;
    hs_ticket_priority?: string;
    createdate?: string;
    closed_date?: string;
    hs_lastmodifieddate?: string;
    hs_time_to_first_response?: string; // milliseconds
    hs_time_to_close?: string; // milliseconds
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
            "subject",
            "hs_pipeline",
            "hs_pipeline_stage",
            "hs_ticket_priority",
            "createdate",
            "closed_date",
            "hs_lastmodifieddate",
            "hs_time_to_first_response",
            "hs_time_to_close",
            "hubspot_owner_id",
            "source_type",
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
  } while (after && page < 10); // cap 1000 tickets

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

export default async function ServiceClientPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  let tickets: TicketHS[] = [];
  let closedStageIds = new Set<string>();
  if (token) {
    [tickets, { closedStageIds }] = await Promise.all([
      fetchAllTickets(token),
      fetchTicketPipeline(token),
    ]);
  }

  const hasData = tickets.length > 0;

  // Volume
  const openTickets = tickets.filter((t) => !closedStageIds.has(t.properties.hs_pipeline_stage ?? "")).length;
  const closedTickets = tickets.length - openTickets;
  const urgentTickets = tickets.filter(
    (t) => t.properties.hs_ticket_priority === "HIGH" || t.properties.hs_ticket_priority === "URGENT",
  ).length;

  // Temps de traitement (hs_time_to_first_response et hs_time_to_close sont en ms)
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

  // CSAT proxy = % résolus en < 24h sur les fermés ayant un time_to_close
  const resolvedFast = timeToCloseMs.filter((ms) => ms <= 24 * 3_600_000).length;
  const csatProxy = timeToCloseMs.length > 0
    ? Math.round((resolvedFast / timeToCloseMs.length) * 100)
    : null;

  // Tickets par contact (via associations)
  const distinctContacts = new Set<string>();
  for (const t of tickets) {
    for (const c of t.associations?.contacts?.results ?? []) distinctContacts.add(c.id);
  }
  const ticketsPerCustomer = distinctContacts.size > 0
    ? Math.round((tickets.length / distinctContacts.size) * 10) / 10
    : null;

  // Score santé service client
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

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Service client — tickets, temps de traitement, satisfaction et risque de churn.
          {hasData && ` Source : HubSpot live (${tickets.length} tickets analysés)`}
        </p>
      </header>

      <PerformancesTabs />

      <InsightLockedBlock
        previewTitle={`Analyse IA de votre service client (score ${score}/100)`}
        previewBody="L'IA Revold corrèle tickets support, satisfaction client et risque de churn pour recommander les actions CSM les plus impactantes sur la rétention."
      />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Volume de tickets
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Total tickets</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{hasData ? fmt(tickets.length) : "—"}</p>
            {snapshot.totalTickets > tickets.length && (
              <p className="mt-1 text-[10px] text-slate-400">sur {fmt(snapshot.totalTickets)} au total</p>
            )}
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Ouverts / en cours</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{hasData ? fmt(openTickets) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Fermés / résolus</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{hasData ? fmt(closedTickets) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Priorité haute</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                urgentTickets > 3 ? "text-red-500" : urgentTickets > 0 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {hasData ? fmt(urgentTickets) : "—"}
            </p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Temps de traitement
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">1ère réponse (moy.)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {avgFirstResponseHours != null ? `${avgFirstResponseHours}h` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">hs_time_to_first_response</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Résolution (moy.)</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                avgResolutionHours != null && avgResolutionHours <= 24
                  ? "text-emerald-600"
                  : avgResolutionHours != null && avgResolutionHours <= 48
                  ? "text-orange-500"
                  : "text-red-500"
              }`}
            >
              {avgResolutionHours != null ? `${avgResolutionHours}h` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">hs_time_to_close</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">CSAT (proxy)</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                csatProxy != null && csatProxy >= 80
                  ? "text-emerald-600"
                  : csatProxy != null && csatProxy >= 60
                  ? "text-orange-500"
                  : "text-red-500"
              }`}
            >
              {csatProxy != null ? `${csatProxy}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">% résolus en &lt;24h</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets / contact</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {ticketsPerCustomer != null ? ticketsPerCustomer.toFixed(1) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{distinctContacts.size} contacts uniques</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Satisfaction & Churn (proxies)
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subscriptions actives</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.activeSubscriptions)}</p>
            <p className="mt-1 text-xs text-slate-400">sur {fmt(snapshot.totalSubscriptions)} au total</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Conversations entrantes</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.totalConversations)}</p>
            <p className="mt-1 text-xs text-slate-400">Inbox HubSpot</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Feedback (CSAT/NPS)</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                snapshot.feedbackCount === 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {fmt(snapshot.feedbackCount)}
            </p>
            <p className="mt-1 text-xs text-slate-400">feedback_submissions</p>
          </article>
        </div>
      </CollapsibleBlock>

      {!hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun ticket dans HubSpot. Activez Service Hub ou connectez vos outils support
            (Zendesk, Intercom, Freshdesk) à HubSpot pour alimenter cette page.
          </p>
        </div>
      )}
    </section>
  );
}
