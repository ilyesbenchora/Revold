export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeys } from "@/lib/integrations/tool-mappings";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { CrossToolSelectorBlock } from "@/components/cross-tool-selector-block";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { fetchPaiementFacturationData, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";

export default async function PaiementFacturationOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const [data, allConnectedTools, mappedKeys] = await Promise.all([
    fetchPaiementFacturationData(token),
    getConnectedTools(supabase, orgId),
    getToolKeys(supabase, orgId, "audit_paiement_facturation"),
  ]);

  const billingCategory = allConnectedTools.filter((t) => t.category === "billing");

  // Si l'utilisateur a configuré un outil source pour cette page (Paramètres
  // → Intégrations → "Outil source par page"), on n'affiche que celui-là.
  // Sinon fallback : tous les outils billing connectés.
  const hasMapping = mappedKeys.length > 0;
  const billingConnected = hasMapping
    ? billingCategory.filter((t) => mappedKeys.includes(t.key))
    : billingCategory;

  // Pas de suggestions à connecter si l'utilisateur a déjà fait son choix.
  const billingSuggestions = hasMapping
    ? []
    : Object.values(CONNECTABLE_TOOLS)
        .filter((t) => t.category === "billing" && !t.comingSoon)
        .map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paiement & Facturation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit cross-source : factures, paiements, MRR/ARR et churn revenue.
          {data.hasData && ` (${data.invoices.length} factures · ${data.subscriptions.length} subscriptions)`}
        </p>
      </header>

      <PaiementFacturationTabs />

      <CrossToolSelectorBlock
        connectedTools={billingConnected}
        suggestedTools={billingSuggestions}
        description={
          hasMapping
            ? "Outil source défini dans Paramètres → Intégrations. Modifiable depuis cette page."
            : "Sélectionnez les outils pour filtrer les facturations & paiements pertinents."
        }
      />

      <InsightLockedBlock
        previewTitle={`Analyse IA paiements & facturation (score ${data.score}/100)`}
        previewBody="L'IA Revold détecte les risques de défaut de paiement, optimise le recouvrement et identifie les patterns de churn liés à la facturation."
      />

      {/* ── Vue d'ensemble : KPIs synthétiques des 2 sous-pages ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="repeat" tone="emerald" />
            Synthèse Revenue récurrent
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
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="file-text" tone="indigo" />
            Synthèse Facturation
          </h2>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Factures émises</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{fmt(data.invoices.length)}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Encaissé</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{data.totalPaid > 0 ? fmtK(data.totalPaid) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{fmt(data.paidInvoicesCount)} payées</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Impayé</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                data.unpaidInvoicesCount > 5
                  ? "text-red-500"
                  : data.unpaidInvoicesCount > 0
                  ? "text-orange-500"
                  : "text-emerald-600"
              }`}
            >
              {fmt(data.unpaidInvoicesCount)}
            </p>
            <p className="mt-1 text-xs text-slate-400">{data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : ""}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Montant moyen</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {data.avgInvoice != null && data.avgInvoice > 0 ? fmtK(data.avgInvoice) : "—"}
            </p>
          </article>
        </div>
      </CollapsibleBlock>

      {!data.hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune facture ni subscription dans HubSpot. Activez HubSpot Invoices/Payments
            ou connectez Stripe / Pennylane pour alimenter cette page automatiquement.
          </p>
        </div>
      )}
    </section>
  );
}
