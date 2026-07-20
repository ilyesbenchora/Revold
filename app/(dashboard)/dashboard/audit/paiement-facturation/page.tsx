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
import { fetchPaiementFacturationFor, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { CreateDataTableButton } from "@/components/data-tables/create-data-table-button";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

export default async function PaiementFacturationOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const [data, allConnectedTools, mappedKeys] = await Promise.all([
    fetchPaiementFacturationFor(supabase, orgId, token),
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
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit cross-source : factures, paiements, MRR/ARR et churn revenue.
            {data.hasData && ` (${data.invoices.length} factures · ${data.subscriptions.length} subscriptions)`}
          </p>
        </div>
        <CreateDataTableButton />
      </header>

      <PaiementFacturationTabs />

      <InsightLockedBlock
        previewTitle={`Analyse IA paiements & facturation (score ${data.score}/100)`}
        previewBody="L'IA Revold détecte les risques de défaut de paiement, optimise le recouvrement et identifie les patterns de churn liés à la facturation."
      />

      {/* ── Vue d'ensemble : KPIs synthétiques des 2 sous-pages ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Synthèse Revenue récurrent
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Synthèse Revenue récurrent"
          subtitle="subscriptions"
          team="finance"
          unit="currency"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "MRR", value: data.mrr > 0 ? data.mrr : null, unit: "currency", cells: ["Mensuel récurrent"] },
            { name: "ARR", value: data.arr > 0 ? data.arr : null, unit: "currency", cells: ["Annualisé (MRR × 12)"] },
            { name: "Subscriptions actives", value: data.activeSubsCount, unit: "count", cells: [`sur ${fmt(data.subscriptions.length)}`] },
            { name: "Taux de churn", value: data.churnRate ?? null, unit: "percent", cells: ["Annulés / total subs"] },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>

      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Synthèse Facturation
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Synthèse Facturation"
          subtitle="invoices"
          team="finance"
          unit="currency"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Factures émises", value: data.invoices.length, unit: "count", cells: ["—"] },
            { name: "Encaissé", value: data.totalPaid > 0 ? data.totalPaid : null, unit: "currency", cells: [`${fmt(data.paidInvoicesCount)} payées`] },
            { name: "Factures impayées", value: data.unpaidInvoicesCount, unit: "count", cells: [data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : "—"] },
            { name: "Montant moyen", value: data.avgInvoice != null && data.avgInvoice > 0 ? data.avgInvoice : null, unit: "currency", cells: ["Par facture émise"] },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>

      {!data.hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune facture ni subscription dans HubSpot. Activez HubSpot Invoices/Payments
            ou connectez Stripe / Pennylane pour alimenter cette page automatiquement.
          </p>
        </div>
      )}

      <PageDataTables pageKey="audit_paiement_facturation" />
    </section>
  );
}
