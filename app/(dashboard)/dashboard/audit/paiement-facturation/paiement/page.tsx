export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { fetchPaiementFacturationData, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";

export default async function PaiementPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const data = await fetchPaiementFacturationData(token);

  // Comptage par statut subscription
  const trialingSubs = data.subscriptions.filter((s) => s.properties.hs_subscription_status === "trialing").length;
  const pastDueSubs = data.subscriptions.filter((s) => s.properties.hs_subscription_status === "past_due").length;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paiement & Facturation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Détail paiements : MRR, ARR, churn, paiements en échec et santé du portefeuille subscriptions.
        </p>
      </header>

      <PaiementFacturationTabs />

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="repeat" tone="emerald" />
            Revenus récurrents
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MRR</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{data.mrr > 0 ? fmtK(data.mrr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Mensuel récurrent</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARR</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.arr > 0 ? fmtK(data.arr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Annualisé (MRR × 12)</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subscriptions actives</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(data.activeSubsCount)}</p>
            <p className="mt-1 text-xs text-slate-400">sur {fmt(data.subscriptions.length)}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARPU</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {data.activeSubsCount > 0 ? fmtK(Math.round(data.mrr / data.activeSubsCount)) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Revenu moy./client/mois</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="alert-triangle" tone="rose" />
            Churn & risque revenue
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de churn</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.churnRate != null && data.churnRate > 10
                  ? "text-red-500"
                  : data.churnRate != null && data.churnRate > 5
                  ? "text-orange-500"
                  : "text-emerald-600"
              }`}
            >
              {data.churnRate != null ? `${data.churnRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Annulés / total subs</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Subscriptions annulées</p>
            <p className="mt-1 text-3xl font-bold text-rose-600">{fmt(data.canceledSubsCount)}</p>
            <p className="mt-1 text-xs text-slate-400">canceled / expired / paused</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Past due</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                pastDueSubs > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {fmt(pastDueSubs)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Paiements en échec</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">En période d&apos;essai</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{fmt(trialingSubs)}</p>
            <p className="mt-1 text-xs text-slate-400">Conversion à monitorer</p>
          </article>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="credit-card" tone="blue" />
            Santé du portefeuille subscriptions
          </h2>
        }
      >
        {data.subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune subscription détectée — connectez Stripe ou activez HubSpot Subscriptions.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Actives</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmt(data.activeSubsCount)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {Math.round((data.activeSubsCount / data.subscriptions.length) * 100)}% du portefeuille
              </p>
            </article>
            <article className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">En essai</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmt(trialingSubs)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {data.subscriptions.length > 0 ? Math.round((trialingSubs / data.subscriptions.length) * 100) : 0}% à convertir
              </p>
            </article>
            <article className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">À risque</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {fmt(pastDueSubs + data.canceledSubsCount)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Past due + canceled / paused / expired
              </p>
            </article>
          </div>
        )}
      </CollapsibleBlock>
    </section>
  );
}
