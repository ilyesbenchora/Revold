export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { fetchServiceClientData, fmt } from "@/lib/audit/service-client-data";
import { fetchPaiementFacturationFor, fmtK } from "@/lib/audit/paiement-facturation-data";

export default async function ServiceClientRenouvellementPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [scData, billing, snapshot] = await Promise.all([
    fetchServiceClientData(token),
    fetchPaiementFacturationFor(supabase, orgId, token),
    getHubspotSnapshot(),
  ]);

  // ── KPIs renouvellement ──
  // Annual subs : celles dont la fréquence est annuelle (renouvellement plus rare mais critique)
  const annualSubs = billing.subscriptions.filter((s) => {
    const f = (s.properties.hs_billing_frequency ?? "").toLowerCase();
    return f.includes("year") || f.includes("annu");
  });
  const monthlySubs = billing.subscriptions.filter((s) => {
    const f = (s.properties.hs_billing_frequency ?? "").toLowerCase();
    return f === "" || f.includes("month") || f.includes("mens");
  });

  // Renewal rate proxy = % de subs actives parmi le total (incl. annulées)
  const renewalRate = billing.subscriptions.length > 0
    ? Math.round((billing.activeSubsCount / billing.subscriptions.length) * 100)
    : null;

  // GRR (Gross Revenue Retention) ≈ 100 - churn rate (sans tenir compte expansion)
  const grr = billing.churnRate != null ? Math.max(0, 100 - billing.churnRate) : null;

  // ARR sécurisé = subs actives × ARPU annuel
  const arpu = billing.activeSubsCount > 0 ? billing.mrr / billing.activeSubsCount : 0;
  const arrSecured = arpu * 12 * billing.activeSubsCount;

  // Risque renouvellement = subs avec problèmes santé (past_due, ticket urgent, etc.)
  const pastDueSubs = billing.subscriptions.filter((s) => s.properties.hs_subscription_status === "past_due").length;
  const renewalAtRisk = pastDueSubs + scData.urgentTickets;
  const arrAtRisk = arpu * 12 * renewalAtRisk;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Renouvellement : taux de rétention, GRR, ARR sécurisé et exposition annuelle.
        </p>
      </header>

      <ServiceClientTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="repeat" tone="emerald" />Taux de renouvellement & rétention
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Renewal rate</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                renewalRate != null && renewalRate >= 95 ? "text-emerald-600" : renewalRate != null && renewalRate >= 85 ? "text-amber-500" : "text-red-500"
              }`}
            >
              {renewalRate != null ? `${renewalRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Active / total subs</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">GRR</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                grr != null && grr >= 95 ? "text-emerald-600" : grr != null && grr >= 85 ? "text-amber-500" : "text-red-500"
              }`}
            >
              {grr != null ? `${grr}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Gross Revenue Retention</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Churn rate</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                billing.churnRate != null && billing.churnRate > 10 ? "text-red-500" : billing.churnRate != null && billing.churnRate > 5 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {billing.churnRate != null ? `${billing.churnRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Cible top quartile : &lt; 5%</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Customers actifs</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.customersCount)}</p>
            <p className="mt-1 text-xs text-slate-400">Lifecycle = customer</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="users" tone="blue" />Cohortes par fréquence
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Les subs annuelles ont un poids ARR plus élevé mais un cycle de renouvellement
          critique : 1 seule échéance par an, donc moins d&apos;opportunités de remédiation.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subs annuelles</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(annualSubs.length)}</p>
            <p className="mt-1 text-xs text-slate-400">Renewal critique 1× par an</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subs mensuelles</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(monthlySubs.length)}</p>
            <p className="mt-1 text-xs text-slate-400">Renewal continu</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">% annuel dans le mix</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {billing.subscriptions.length > 0
                ? `${Math.round((annualSubs.length / billing.subscriptions.length) * 100)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">+ d&apos;annuel = + de stabilité revenue</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="shield" tone="amber" />ARR sécurisé vs à risque
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARR sécurisé</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {arrSecured > 0 ? fmtK(arrSecured) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Subs actives healthy</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARR à risque</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                renewalAtRisk > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {arrAtRisk > 0 ? fmtK(arrAtRisk) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Past due + tickets urgents</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subs à risque</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                renewalAtRisk > 5 ? "text-red-500" : renewalAtRisk > 0 ? "text-orange-500" : "text-emerald-600"
              }`}
            >
              {fmt(renewalAtRisk)}
            </p>
            <p className="mt-1 text-xs text-slate-400">À traiter en CSM proactif</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="user-clock" tone="fuchsia" />Engagement pré-renouvellement
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Indicateurs d&apos;engagement à surveiller dans les 90 jours avant échéance :
          plus le compte est actif, plus la probabilité de renouvellement augmente.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Conversations entrantes</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(snapshot.totalConversations)}</p>
            <p className="mt-1 text-xs text-slate-400">Engagement Inbox</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tickets résolus &lt; 24h</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                scData.csatProxy != null && scData.csatProxy >= 80 ? "text-emerald-600" : scData.csatProxy != null && scData.csatProxy >= 60 ? "text-orange-500" : "text-red-500"
              }`}
            >
              {scData.csatProxy != null ? `${scData.csatProxy}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Proxy CSAT</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Feedback collecté</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                snapshot.feedbackCount === 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {fmt(snapshot.feedbackCount)}
            </p>
            <p className="mt-1 text-xs text-slate-400">CSAT/NPS submissions</p>
          </article>
        </div>
      </CollapsibleBlock>
    </section>
  );
}
