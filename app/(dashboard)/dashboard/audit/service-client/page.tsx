export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { CrossToolSelectorBlock } from "@/components/cross-tool-selector-block";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";

export default async function ServiceClientOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [data, snapshot, allConnectedTools] = await Promise.all([
    fetchServiceClientData(token),
    getHubspotSnapshot(),
    getConnectedTools(supabase, orgId),
  ]);

  const supportConnected = allConnectedTools.filter((t) => t.category === "support");
  const supportSuggestions = Object.values(CONNECTABLE_TOOLS)
    .filter((t) => t.category === "support" && !t.comingSoon)
    .map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit cross-source : tickets, satisfaction, churn et expansion CSM.
          {data.hasData && ` (${data.tickets.length} tickets analysés)`}
        </p>
      </header>

      <ServiceClientTabs />

      <CrossToolSelectorBlock
        connectedTools={supportConnected}
        suggestedTools={supportSuggestions}
        description="Sélectionnez les outils pour filtrer les tickets, conversations et signaux de satisfaction pertinents."
      />

      <InsightLockedBlock
        previewTitle={`Analyse IA service client (score ${data.score}/100)`}
        previewBody="L'IA Revold corrèle tickets support, satisfaction client et risque de churn pour recommander les actions CSM les plus impactantes sur la rétention."
      />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="headset" tone="blue" />Volume de tickets
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Total tickets</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.hasData ? fmt(data.tickets.length) : "—"}</p>
            {snapshot.totalTickets > data.tickets.length && (
              <p className="mt-1 text-[10px] text-slate-400">sur {fmt(snapshot.totalTickets)} au total</p>
            )}
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Ouverts / en cours</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{data.hasData ? fmt(data.openTickets) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Fermés / résolus</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{data.hasData ? fmt(data.closedTickets) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Priorité haute</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.urgentTickets > 3 ? "text-red-500" : data.urgentTickets > 0 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {data.hasData ? fmt(data.urgentTickets) : "—"}
            </p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="message-circle" tone="fuchsia" />Signaux satisfaction & engagement
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

      {!data.hasData && (
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
