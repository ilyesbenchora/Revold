import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PerformancesTabs } from "@/components/performances-tabs";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

function diffHours(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

export default async function ServiceClientPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  type TicketRow = {
    id: string;
    status: string;
    priority: string | null;
    opened_at: string | null;
    resolved_at: string | null;
    first_response_at: string | null;
    contact_id: string | null;
    company_id: string | null;
  };

  let tickets: TicketRow[] = [];
  let totalContacts = 0;
  let canceledContactIds = new Set<string>();

  try {
    const [{ data: ticketData }, { count: contactCount }, { data: canceledSubs }] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, status, priority, opened_at, resolved_at, first_response_at, contact_id, company_id")
        .eq("organization_id", orgId),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("subscriptions")
        .select("contact_id")
        .eq("organization_id", orgId)
        .eq("status", "canceled")
        .not("contact_id", "is", null),
    ]);
    tickets = (ticketData ?? []) as TicketRow[];
    totalContacts = contactCount ?? 0;
    canceledContactIds = new Set(
      (canceledSubs ?? []).map((s) => s.contact_id as string).filter(Boolean),
    );
  } catch {}

  const hasData = tickets.length > 0;

  // ── Volume breakdown ──
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "pending").length;
  const closedTickets = tickets.filter((t) => t.status === "closed" || t.status === "resolved").length;
  const urgentTickets = tickets.filter((t) => t.priority === "high" || t.priority === "urgent").length;

  // ── Resolution time (avg hours, for resolved tickets with both timestamps) ──
  const resolved = tickets.filter((t) => t.resolved_at && t.opened_at);
  const avgResolutionHours = resolved.length > 0
    ? Math.round(resolved.reduce((s, t) => s + diffHours(t.resolved_at!, t.opened_at!), 0) / resolved.length)
    : null;

  // ── First response time ──
  const withFirstResponse = tickets.filter((t) => t.first_response_at && t.opened_at);
  const avgFirstResponseHours = withFirstResponse.length > 0
    ? Math.round(
        withFirstResponse.reduce((s, t) => s + diffHours(t.first_response_at!, t.opened_at!), 0) /
          withFirstResponse.length,
      )
    : null;

  // ── CSAT proxy (resolved in < 24h / total resolved) ──
  const resolvedFast = resolved.filter((t) => diffHours(t.resolved_at!, t.opened_at!) <= 24).length;
  const csatProxy = resolved.length > 0 ? Math.round((resolvedFast / resolved.length) * 100) : null;

  // ── Tickets per customer ──
  const distinctTicketContacts = new Set(tickets.map((t) => t.contact_id).filter(Boolean)).size;
  const ticketsPerCustomer = distinctTicketContacts > 0
    ? Math.round((tickets.length / distinctTicketContacts) * 10) / 10
    : null;

  // ── Churn correlation (% churned contacts who opened tickets) ──
  const ticketContactIds = new Set(tickets.map((t) => t.contact_id).filter(Boolean));
  const churnedWithTickets = [...canceledContactIds].filter((id) => ticketContactIds.has(id)).length;
  const churnCorrelation = canceledContactIds.size > 0
    ? Math.round((churnedWithTickets / canceledContactIds.size) * 100)
    : null;

  // ── NRR proxy (1 - churn rate) from subscriptions ──
  // This is a rough proxy; real NRR requires expansion data we don't have yet.
  let nrrProxy: number | null = null;
  try {
    const [{ count: activeSubs }, { count: totalSubs }] = await Promise.all([
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("organization_id", orgId).in("status", ["active", "trialing"]),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    ]);
    if ((totalSubs ?? 0) > 0) {
      nrrProxy = Math.round(((activeSubs ?? 0) / (totalSubs ?? 1)) * 100);
    }
  } catch {}

  // ── Score ──
  const score = hasData
    ? Math.round(
        (csatProxy ?? 70) * 0.3 +
        (avgResolutionHours != null ? Math.min(100, Math.max(0, (1 - avgResolutionHours / 72) * 100)) : 50) * 0.3 +
        (churnCorrelation != null ? Math.max(0, 100 - churnCorrelation * 2) : 60) * 0.2 +
        (urgentTickets === 0 ? 100 : urgentTickets < 3 ? 60 : 20) * 0.2,
      )
    : 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPIs de service client — tickets, temps de traitement, satisfaction et risque de churn (Zendesk, Intercom, Freshdesk…).
        </p>
      </header>

      <PerformancesTabs />

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Service Client" score={score} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{score}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(score).className}`}>
              {getScoreLabel(score).label}
            </span>
          </div>
        </div>
      </div>

      {/* Volume de tickets */}
      <CollapsibleBlock title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Volume de tickets
        </h2>
      }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Total tickets</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{hasData ? fmt(tickets.length) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Ouverts / en cours</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{hasData ? fmt(openTickets) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Résolus / fermés</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{hasData ? fmt(closedTickets) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Urgents / haute prio</p>
            <p className={`mt-1 text-3xl font-bold ${urgentTickets > 3 ? "text-red-500" : urgentTickets > 0 ? "text-orange-500" : "text-emerald-600"}`}>
              {hasData ? fmt(urgentTickets) : "—"}
            </p>
          </article>
        </div>
      </CollapsibleBlock>

      {/* Temps de traitement */}
      <CollapsibleBlock title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Temps de traitement
        </h2>
      }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">1ère réponse (moy.)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {avgFirstResponseHours != null ? `${avgFirstResponseHours}h` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Temps de première réponse</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Résolution (moy.)</p>
            <p className={`mt-1 text-3xl font-bold ${avgResolutionHours != null && avgResolutionHours <= 24 ? "text-emerald-600" : avgResolutionHours != null && avgResolutionHours <= 48 ? "text-orange-500" : "text-red-500"}`}>
              {avgResolutionHours != null ? `${avgResolutionHours}h` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Temps de résolution moyen</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">CSAT (proxy)</p>
            <p className={`mt-1 text-3xl font-bold ${csatProxy != null && csatProxy >= 80 ? "text-emerald-600" : csatProxy != null && csatProxy >= 60 ? "text-orange-500" : "text-red-500"}`}>
              {csatProxy != null ? `${csatProxy}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">% résolus en &lt;24h</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets / client</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{ticketsPerCustomer != null ? ticketsPerCustomer.toFixed(1) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Volume moyen par contact</p>
          </article>
        </div>
      </CollapsibleBlock>

      {/* Satisfaction & Churn */}
      <CollapsibleBlock title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Satisfaction & Churn
        </h2>
      }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">NRR (proxy)</p>
            <p className={`mt-1 text-3xl font-bold ${nrrProxy != null && nrrProxy >= 90 ? "text-emerald-600" : nrrProxy != null && nrrProxy >= 70 ? "text-orange-500" : "text-red-500"}`}>
              {nrrProxy != null ? `${nrrProxy}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Net Revenue Retention estimé</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Churn correlation</p>
            <p className={`mt-1 text-3xl font-bold ${churnCorrelation != null && churnCorrelation > 50 ? "text-red-500" : churnCorrelation != null && churnCorrelation > 25 ? "text-orange-500" : "text-emerald-600"}`}>
              {churnCorrelation != null ? `${churnCorrelation}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">% churns ayant ouvert un ticket</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts clients</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{hasData ? fmt(distinctTicketContacts) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">sur {fmt(totalContacts)} contacts</p>
          </article>
        </div>
      </CollapsibleBlock>

      {!hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune donnée de service client pour l&apos;instant. Connectez Zendesk, Intercom, Freshdesk ou Crisp
            pour alimenter cette page automatiquement.
          </p>
        </div>
      )}
    </section>
  );
}
