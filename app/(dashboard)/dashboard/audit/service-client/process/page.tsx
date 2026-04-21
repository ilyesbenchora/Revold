export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";

export default async function ServiceClientProcessPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [data, snapshot] = await Promise.all([
    fetchServiceClientData(token),
    getHubspotSnapshot(),
  ]);

  // Process onboarding KPIs
  // - Time to first response : SLA d'accueil pour nouveau client
  // - Time to resolution : qualité onboarding
  // - Tickets par contact : si > 3, signal d'un onboarding qui échoue
  // - % tickets onboarding (sujet contient "onboarding" ou "setup")
  const onboardingTickets = data.tickets.filter((t) =>
    /(onboard|setup|installation|kickoff|first|premier|d[ée]marrage)/i.test(t.properties.subject ?? ""),
  );
  const onboardingResolved = onboardingTickets.filter((t) => t.properties.closed_date).length;
  const onboardingResolutionRate = onboardingTickets.length > 0
    ? Math.round((onboardingResolved / onboardingTickets.length) * 100)
    : null;

  // SLA respecté = % de tickets avec 1ère réponse < 4h
  const ticketsWithFirstResponse = data.tickets
    .map((t) => parseFloat(t.properties.hs_time_to_first_response ?? ""))
    .filter((n) => !isNaN(n) && n > 0);
  const slaRespected = ticketsWithFirstResponse.filter((ms) => ms <= 4 * 3_600_000).length;
  const slaRate = ticketsWithFirstResponse.length > 0
    ? Math.round((slaRespected / ticketsWithFirstResponse.length) * 100)
    : null;

  // Customers handoff = % d'opportunités converties en customer (snapshot)
  const handoffRate = snapshot.opportunitiesCount > 0
    ? Math.round((snapshot.customersCount / (snapshot.opportunitiesCount + snapshot.customersCount)) * 100)
    : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Process onboarding : SLA, taux de résolution onboarding, handoff sales→CSM.
        </p>
      </header>

      <ServiceClientTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />SLA d&apos;accueil & première réponse
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">1ère réponse moy.</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.avgFirstResponseHours != null && data.avgFirstResponseHours <= 4
                  ? "text-emerald-600"
                  : data.avgFirstResponseHours != null && data.avgFirstResponseHours <= 24
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {data.avgFirstResponseHours != null ? `${data.avgFirstResponseHours}h` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">SLA cible : ≤ 4h</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">SLA respecté</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                slaRate != null && slaRate >= 80
                  ? "text-emerald-600"
                  : slaRate != null && slaRate >= 60
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {slaRate != null ? `${slaRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">% tickets &lt; 4h</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Résolution moy.</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.avgResolutionHours != null && data.avgResolutionHours <= 24
                  ? "text-emerald-600"
                  : data.avgResolutionHours != null && data.avgResolutionHours <= 48
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {data.avgResolutionHours != null ? `${data.avgResolutionHours}h` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Cible : ≤ 24h</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets / contact</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.ticketsPerCustomer != null && data.ticketsPerCustomer > 3
                  ? "text-red-500"
                  : data.ticketsPerCustomer != null && data.ticketsPerCustomer > 1.5
                  ? "text-amber-500"
                  : "text-emerald-600"
              }`}
            >
              {data.ticketsPerCustomer != null ? data.ticketsPerCustomer.toFixed(1) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{fmt(data.distinctContactsCount)} contacts uniques</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Onboarding & livraison
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets onboarding</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(onboardingTickets.length)}</p>
            <p className="mt-1 text-xs text-slate-400">Sujet contient onboard / setup / kickoff</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Onboarding résolus</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                onboardingResolutionRate != null && onboardingResolutionRate >= 80
                  ? "text-emerald-600"
                  : onboardingResolutionRate != null && onboardingResolutionRate >= 50
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {onboardingResolutionRate != null ? `${onboardingResolutionRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{onboardingResolved} sur {onboardingTickets.length}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Handoff sales → CSM</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {handoffRate != null ? `${handoffRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Customers / (opps + customers)</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-amber-500" />Capacité opérationnelle
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets ouverts</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.openTickets > 50 ? "text-red-500" : data.openTickets > 20 ? "text-amber-500" : "text-emerald-600"
              }`}
            >
              {fmt(data.openTickets)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Charge actuelle CSM</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Conversations entrantes</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.totalConversations)}</p>
            <p className="mt-1 text-xs text-slate-400">Volume Inbox</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subscriptions actives</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.activeSubscriptions)}</p>
            <p className="mt-1 text-xs text-slate-400">Portefeuille à servir</p>
          </article>
        </div>
      </CollapsibleBlock>
    </section>
  );
}
