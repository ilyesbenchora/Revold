export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { fetchPaiementFacturationFor, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { SourceToolSwitcher } from "@/components/source-tool-switcher";
import { getSwitchableBillingTools, validateSourceParam } from "@/lib/audit/source-switch";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";

// Clé de personnalisation propre à la sous-page (tuiles, blocs masqués, tables) —
// catalogue de KPIs et filtre d'outils hérités de la page Trésorerie parente.
const PAGE_KEY = "audit_paiement_facturation_facturation";

export default async function FacturationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const sp = (await searchParams) ?? {};
  const switchableTools = await getSwitchableBillingTools(supabase, orgId, token, ["audit_paiement_facturation_facturation", "audit_paiement_facturation"]);
  const overrideSource = validateSourceParam(typeof sp.source === "string" ? sp.source : null, switchableTools);

  const [data, snapshot] = await Promise.all([
    fetchPaiementFacturationFor(supabase, orgId, token, overrideSource, ["audit_paiement_facturation_facturation", "audit_paiement_facturation"]),
    getHubspotSnapshot(),
  ]);
  const activeSourceKey = data.source ?? "hubspot";

  // Audit factures > 30 jours impayées (DSO élevé)
  const now = Date.now();
  const overdueInvoices = data.invoices.filter((i) => {
    if (!["open", "uncollectible"].includes(i.properties.hs_invoice_status ?? "")) return false;
    const dueStr = i.properties.hs_due_date;
    if (!dueStr) return false;
    const due = parseInt(dueStr, 10);
    return !isNaN(due) && now - due > 30 * 86_400_000;
  });

  // Personnalisation de la page : tuiles masquées/ajoutées + blocs retirés.
  const custom = await getPageCustomization(supabase, orgId, PAGE_KEY);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Détail facturation : émission, recouvrement, encaissement, devis et lignes vendues.
        </p>
      </header>

      <PaiementFacturationTabs />

      {/* ── Tuiles KPI configurables (1 ligne) : lecture cockpit + KPIs ajoutés ── */}
      {(() => {
        const defaults: DefaultTile[] = data.hasData
          ? [
              { key: "factures_emises", label: "Factures émises", value: fmt(data.invoices.length), raw: data.invoices.length, rawUnit: "count", tone: "neutral", sub: data.avgInvoice != null && data.avgInvoice > 0 ? `${fmtK(data.avgInvoice)} en moyenne` : "Montant moyen —" },
              { key: "total_encaisse", label: "Total encaissé", value: data.totalPaid > 0 ? fmtK(data.totalPaid) : "—", raw: data.totalPaid > 0 ? Math.round(data.totalPaid) : null, rawUnit: "currency", tone: "pos", sub: `${fmt(data.paidInvoicesCount)} factures payées` },
              {
                key: "impayees",
                label: "Impayées",
                value: String(data.unpaidInvoicesCount),
                raw: data.unpaidInvoicesCount,
                rawUnit: "count",
                tone: data.unpaidInvoicesCount === 0 ? "pos" : "neg",
                sub: data.totalUnpaidAmount > 0 ? `${fmtK(data.totalUnpaidAmount)} en attente` : "Rien en attente",
                verdict: data.unpaidInvoicesCount === 0 ? { label: "Tout est encaissé", tone: "pos" }
                  : data.unpaidInvoicesCount <= 5 ? { label: "À relancer", tone: "warn" }
                  : { label: "Recouvrement critique", tone: "neg" },
              },
              {
                key: "retard_30j",
                label: "Retard > 30 jours",
                value: String(overdueInvoices.length),
                raw: overdueInvoices.length,
                rawUnit: "count",
                tone: overdueInvoices.length === 0 ? "pos" : "neg",
                sub: "Factures échues depuis + de 30 j",
                verdict: overdueInvoices.length === 0 ? { label: "DSO maîtrisé", tone: "pos" }
                  : { label: "DSO élevé", tone: "neg" },
              },
            ]
          : [];
        return (
          <ConfigurableKpiTiles
            supabase={supabase}
            orgId={orgId}
            pageKey={PAGE_KEY}
            defaults={defaults}
            customization={custom}
            tablesPageKey={PAGE_KEY}
            hiddenBlocks={hiddenBlockList(custom)}
          />
        );
      })()}

      {!custom.hiddenBlocks.has("emission_encaissement") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="emission_encaissement" label="Émission & encaissement">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Émission & encaissement
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Émission & encaissement"
          subtitle="invoices"
          team="finance"
          unit="currency"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Factures émises", value: data.invoices.length, unit: "count", cells: ["—"] },
            { name: "Montant moyen", value: data.avgInvoice != null && data.avgInvoice > 0 ? data.avgInvoice : null, unit: "currency", cells: ["Par facture émise"] },
            { name: "Factures impayées", value: data.unpaidInvoicesCount, unit: "count", cells: [data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : "—"] },
            { name: "Total encaissé", value: data.totalPaid > 0 ? data.totalPaid : null, unit: "currency", cells: [`${fmt(data.paidInvoicesCount)} factures payées`] },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("recouvrement_dso") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="recouvrement_dso" label="Recouvrement & DSO">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Recouvrement & DSO
            {overdueInvoices.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {overdueInvoices.length} en retard
              </span>
            )}
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Recouvrement & DSO"
          subtitle="invoices"
          team="finance"
          unit="count"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Factures > 30j impayées", value: overdueInvoices.length, unit: "count", cells: ["DSO élevé = trésorerie à risque"] },
            {
              name: "Taux de paiement",
              value: data.invoices.length > 0 ? Math.round((data.paidInvoicesCount / data.invoices.length) * 100) : null,
              unit: "percent",
              cells: ["Payées / émises"],
            },
            { name: "Encours total", value: data.totalUnpaidAmount > 0 ? data.totalUnpaidAmount : null, unit: "currency", cells: ["Cash à collecter"] },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("pipeline_devis") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="pipeline_devis" label="Pipeline revenue & devis">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Pipeline revenue & devis
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Pipeline revenue & devis"
          subtitle="deals · quotes · line items"
          team="finance"
          unit="currency"
          nameLabel="Indicateur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Pipeline ouvert", value: snapshot.totalPipelineAmount > 0 ? snapshot.totalPipelineAmount : null, unit: "currency", cells: [`${fmt(snapshot.openDeals)} deals`] },
            { name: "Won historique", value: snapshot.wonAmount > 0 ? snapshot.wonAmount : null, unit: "currency", cells: [`${fmt(snapshot.wonDeals)} deals gagnés`] },
            { name: "Devis émis", value: snapshot.totalQuotes, unit: "count", cells: ["HubSpot Quotes"] },
            { name: "Line items", value: snapshot.totalLineItems, unit: "count", cells: ["SKUs vendus"] },
          ]}
          footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {/* ── Tables & graphiques ajoutés par l'utilisateur (funnel unique) ── */}
      <PageDataTables pageKey={PAGE_KEY} />

      {!data.hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune facture dans HubSpot. Activez HubSpot Invoices ou connectez un outil de
            facturation (Stripe, Pennylane) dans Intégrations pour alimenter cette page.
          </p>
        </div>
      )}

      {/* Outil source des blocs — rappel discret en bas de page, switch au clic */}
      <SourceToolSwitcher
        tools={switchableTools.map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }))}
        activeKey={activeSourceKey}
      />
    </section>
  );
}
