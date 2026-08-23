export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getToolKeys } from "@/lib/integrations/tool-mappings";
import {
  getSwitchableBillingTools,
  validateSourceParam,
  validateSourcesParam,
  capabilitiesOf,
  availableCrossViews,
} from "@/lib/audit/source-switch";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { fetchPaiementFacturationFor, fmt, fmtK, type PaiementFacturationData } from "@/lib/audit/paiement-facturation-data";
import { computeCashflow } from "@/lib/audit/cashflow";
import { computeCrossMargin } from "@/lib/audit/cross-margin";
import { computeTreasuryForecast, type TreasuryForecast } from "@/lib/audit/treasury-forecast";
import type { OrgFiscalParams } from "@/lib/audit/fiscal-schedule";
import { computeDealsSeries } from "@/lib/audit/deals-series";
import { TresoLineChart, TresoFlowsChart, SimpleBarsChart } from "@/components/charts/treso-charts";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { HBarChart } from "@/components/charts/hbar-chart";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { CashRecoveryBlock } from "@/components/roi/cash-recovery-block";
import { ReconciliationHealthCard } from "@/components/reconciliation/reconciliation-health-card";
import { DealInvoiceLinks } from "@/components/reconciliation/deal-invoice-links";
import { EstablishmentBreakdown } from "@/components/reconciliation/establishment-breakdown";
import { GapReviewQueue } from "@/components/reconciliation/gap-review-queue";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { SourceToolSwitcher } from "@/components/source-tool-switcher";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList, type HiddenBlockMeta } from "@/lib/kpi/page-tiles";

export default async function PaiementFacturationOverviewPage({
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
  const switchableTools = await getSwitchableBillingTools(supabase, orgId, token, "audit_paiement_facturation");

  // ── Sélection multi-sources (?sources=a,b) — rétro-compatible ?source=x ──
  let selectedKeys = validateSourcesParam(typeof sp.sources === "string" ? sp.sources : null, switchableTools);
  if (selectedKeys.length === 0) {
    const single = validateSourceParam(typeof sp.source === "string" ? sp.source : null, switchableTools);
    if (single) selectedKeys = [single];
  }
  // Sans sélection d'URL : ISO avec les Paramètres — les outils choisis dans
  // « Outil source par page » (Paramètres → Intégrations) sont présélectionnés.
  // Sans mapping non plus : état neutre, l'utilisateur choisit ses sources.
  if (selectedKeys.length === 0) {
    const mappedKeys = await getToolKeys(supabase, orgId, "audit_paiement_facturation");
    if (mappedKeys.length > 0) {
      selectedKeys = switchableTools.filter((t) => mappedKeys.includes(t.key)).map((t) => t.key);
    }
  }

  // ── Règle d'affichage dynamique (déclarative, cf. source-switch.ts) ──
  //   0 outil   → invite, aucun bloc
  //   1 outil   → les blocs de CET outil (selon ses capacités)
  //   2+ outils → UNIQUEMENT les vues croisées couvertes par la sélection
  const isMulti = selectedKeys.length > 1;
  const crossViews = availableCrossViews(selectedKeys);
  const hasCross = crossViews.some((v) => v.key === "crm-billing");

  const labelOf = (key: string) =>
    switchableTools.find((t) => t.key === key)?.label ?? (key === "hubspot" ? "HubSpot" : key);

  // ── Fetch limité à ce que le mode affiche (mode croisé : uniquement les
  //    données nécessaires au calcul de la marge) ──
  const singleTool = selectedKeys.length === 1;
  const billingKeys = singleTool || hasCross
    ? selectedKeys.filter((k) => {
        const c = capabilitiesOf(k);
        return c.includes("invoices") || c.includes("subscriptions");
      })
    : [];
  const cashflowKeys = singleTool || hasCross
    ? selectedKeys.filter((k) => capabilitiesOf(k).includes("cashflow"))
    : [];

  const [billingResults, cashflowResults] = await Promise.all([
    Promise.all(billingKeys.map(async (k) => ({ key: k, data: await fetchPaiementFacturationFor(supabase, orgId, token, k) }))),
    Promise.all(cashflowKeys.map(async (k) => ({ key: k, cf: await computeCashflow(supabase, orgId, k) }))),
  ]);

  // ── Croisement CRM × Facturation : marge (hasCross déclaré plus haut) ──
  const crossBillingEntry =
    billingResults.find((b) => !capabilitiesOf(b.key).includes("deals")) ?? billingResults[0];
  const crossCashflow = cashflowResults[0]?.cf ?? null;
  const margin = hasCross && crossBillingEntry
    ? await computeCrossMargin(supabase, orgId, {
        caEncaisse: crossBillingEntry.data.totalPaid,
        decaissements: crossCashflow?.hasOutflows ? crossCashflow.decaissementsTotal : null,
      })
    : null;

  const anyData =
    billingResults.some((b) => b.data.hasData) ||
    cashflowResults.some((c) => c.cf.hasData);
  const scoreData: PaiementFacturationData | undefined = billingResults[0]?.data;

  // ── Outils qui alimentent RÉELLEMENT chaque bloc croisé (pastilles honnêtes :
  //    avec plusieurs outils de facturation sélectionnés, l'encaissé vient du
  //    premier outil facturation — pas de tous). ──
  const crmKey = selectedKeys.find((k) => capabilitiesOf(k).includes("deals")) ?? null;
  const billingUsedKey = crossBillingEntry?.key ?? null;
  const cashflowUsedKey = cashflowResults[0]?.key ?? null;
  const chipLabels = (keys: Array<string | null>) => [...new Set(keys.filter((k): k is string => !!k))].map(labelOf);

  // ── Page mono-outil : bloc « Chiffre d'affaires » (CA signé — CRM seul,
  //    ou réconciliation signé vs encaissé sur la page d'un outil de
  //    facturation). Marge et Prévisions restent en vue croisée. ──
  const singleKey = singleTool ? selectedKeys[0] : null;
  const singleIsCrm = singleKey ? capabilitiesOf(singleKey).includes("deals") : false;
  const singleCa = singleKey
    ? await computeCrossMargin(supabase, orgId, {
        caEncaisse: singleIsCrm ? 0 : (billingResults.find((b) => b.key === singleKey)?.data.totalPaid ?? 0),
        decaissements: null,
      })
    : null;
  const connectedCrmLabel =
    switchableTools.find((t) => capabilitiesOf(t.key).includes("deals"))?.label ?? "CRM";

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "audit_paiement_facturation");

  // ── Séries pour les graphes de la vue croisée (style cockpit Lomed) :
  //    CA signé par mois, marge mensuelle et projection 12 mois. ──
  const dealsSeries = margin || (singleCa?.hasDeals && singleIsCrm) ? await computeDealsSeries(supabase, orgId) : null;
  let forecast: TreasuryForecast | null = null;
  if (margin) {
    const { data: orgFiscal } = await supabase
      .from("organizations")
      .select("fiscal_tva_periodicite, fiscal_tva_prochaine, fiscal_tva_montant, fiscal_is_periodicite, fiscal_is_prochaine, fiscal_is_montant, fiscal_urssaf_periodicite, fiscal_urssaf_prochaine, fiscal_urssaf_montant")
      .eq("id", orgId)
      .maybeSingle();
    forecast = await computeTreasuryForecast(supabase, orgId, crossCashflow, (orgFiscal ?? null) as OrgFiscalParams | null);
  }
  // Marge mensuelle approchée = encaissements − décaissements du mois (flux réels).
  const margeMensuelle = (crossCashflow?.monthlyFlows ?? [])
    .map((p) => ({ label: p.label, value: Math.round(p.in - p.out) }));

  const eur = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  // Tuiles par défaut : disponibles uniquement en vue croisée (marge CRM × facturation).
  const defaultTiles: DefaultTile[] = margin
    ? [
        {
          key: "ca_signe",
          label: "CA signé",
          value: margin.caSigne > 0 ? eur(margin.caSigne) : "—",
          raw: Math.round(margin.caSigne),
          rawUnit: "currency",
          tone: "neutral",
          sub: `${fmt(margin.dealsGagnesCount)} deals gagnés (CRM)`,
        },
        {
          key: "ca_encaisse",
          label: "CA encaissé",
          value: margin.caEncaisse > 0 ? eur(margin.caEncaisse) : "—",
          raw: Math.round(margin.caEncaisse),
          rawUnit: "currency",
          tone: "accent",
          sub: "Factures payées (facturation)",
          verdict: margin.caSigne > 0
            ? margin.ecartSigneEncaisse > 0
              ? { label: `${eur(margin.ecartSigneEncaisse)} signés non encaissés`, tone: "warn" }
              : { label: "Tout le signé est encaissé", tone: "pos" }
            : undefined,
        },
        {
          key: "taux_marge",
          label: "Taux de marge",
          value: margin.tauxMarge != null ? `${margin.tauxMarge} %` : "—",
          raw: margin.tauxMarge,
          rawUnit: "percent",
          tone: margin.tauxMarge == null ? "neutral" : margin.tauxMarge >= 40 ? "pos" : margin.tauxMarge >= 25 ? "accent" : "neg",
          sub: "Marge brute / CA encaissé",
          verdict: margin.tauxMarge == null ? undefined
            : margin.tauxMarge >= 40 ? { label: "Excellent (> 40 %)", tone: "pos" }
            : margin.tauxMarge >= 25 ? { label: "Correct", tone: "warn" }
            : { label: "Faible (< 25 %)", tone: "neg" },
        },
        {
          key: "prevision_marge",
          label: "Prévision de marge",
          value: margin.previsionMarge != null ? eur(margin.previsionMarge) : "—",
          raw: margin.previsionMarge != null ? Math.round(margin.previsionMarge) : null,
          rawUnit: "currency",
          tone: "neutral",
          sub: "Pipeline pondéré × taux de marge",
        },
      ]
    : [];

  return (
    <section className="space-y-6">
      {/* Pas de CTA table ici : la section « Tables de données » en bas a le sien. */}
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit cross-source : factures, paiements, MRR/ARR, trésorerie et marge.
        </p>
      </header>

      <PaiementFacturationTabs />

      {/* ── 0 outil : invite — rien ne s'affiche tant qu'aucune source n'est choisie ── */}
      {selectedKeys.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Choisis ta source pour activer les blocs.</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Sélectionne un outil via « Sources des blocs » en bas de page, ou dans
            Paramètres → Intégrations → Outil source par page.
          </p>
        </div>
      )}

      {selectedKeys.length > 0 && (
        <InsightLockedBlock
          previewTitle={`Analyse IA paiements & facturation (score ${scoreData?.score ?? 0}/100)`}
          previewBody="L'IA Revold détecte les risques de défaut de paiement, optimise le recouvrement et identifie les patterns de churn liés à la facturation."
        />
      )}

      {/* ── Tuiles KPI configurables : défauts en vue croisée + KPIs ajoutés ── */}
      {selectedKeys.length > 0 && (
        <ConfigurableKpiTiles
          supabase={supabase}
          orgId={orgId}
          pageKey="audit_paiement_facturation"
          defaults={defaultTiles}
          customization={custom}
          tablesPageKey="audit_paiement_facturation"
          hiddenBlocks={hiddenBlockList(custom, (key): HiddenBlockMeta | undefined => {
            if (key.startsWith("subs_")) return { view: "table", description: "MRR, ARR, abonnements actifs, churn", preview: { entity: "subscriptions", groupBy: "status", measure: "sum", field: "mrr", unit: "currency", view: "bar" } };
            if (key.startsWith("invoices_")) return { view: "table", description: "Factures émises, encaissé, impayés, montant moyen", preview: { entity: "invoices", groupBy: "month_issued", measure: "sum", field: "amount_total", unit: "currency", view: "line" } };
            if (key.startsWith("cashflow_")) return { view: "chart-line", description: "Trésorerie : flux, solde, runway + graphiques et charges", preview: { entity: "transactions", groupBy: "month_transaction", measure: "sum", field: "amount", unit: "currency", view: "line" } };
            if (key === "ca_signe") return { view: "table", description: "Chiffre d'affaires : CA signé (et réconciliation encaissé sur un outil de facturation)", preview: { entity: "deals", groupBy: "month_closed", measure: "sum", field: "amount", unit: "currency", view: "line" } };
            if (key === "cross_ca") return { view: "table", description: "CA signé vs encaissé (réconciliation CRM × facturation)", preview: { entity: "invoices", groupBy: "month_issued", measure: "sum", field: "amount_paid", unit: "currency", view: "line" } };
            if (key === "cross_marge") return { view: "table", description: "Marge brute et taux de marge (encaissé − décaissements)", preview: { entity: "transactions", groupBy: "category", measure: "sum", field: "amount_out", unit: "currency", view: "bar" } };
            if (key === "cross_previsions") return { view: "table", description: "Prévision de marge (pipeline pondéré × taux de marge)", preview: { entity: "deals", groupBy: "stage", measure: "sum", field: "amount", unit: "currency", view: "bar" } };
            return undefined;
          })}
        />
      )}

      {/* ── 2+ outils sans croisement possible : on l'explique au lieu d'afficher du faux ── */}
      {isMulti && crossViews.length === 0 && (
        <div className="rounded-2xl border border-dashed border-fuchsia-200 bg-fuchsia-50/40 p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Aucun croisement disponible pour {selectedKeys.map(labelOf).join(" + ")}.
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Ces outils couvrent les mêmes types de données. Pour une vue croisée (ex : marge),
            combine un CRM (deals) avec un outil de facturation — ou garde un seul outil pour voir ses blocs.
          </p>
        </div>
      )}

      {/* ── 1 outil : Chiffre d'affaires — le CA signé (CRM) a sa place sur la
             page HubSpot ; sur la page d'un outil de facturation, il est
             réconcilié avec l'encaissé de CET outil. Les pastilles disent
             d'où vient chaque donnée. ── */}
      {singleKey && singleCa?.hasDeals && !custom.hiddenBlocks.has("ca_signe") && (
        <RemovableBlock pageKey="audit_paiement_facturation" blockKey="ca_signe" label="Chiffre d'affaires">
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Chiffre d&apos;affaires
              {(singleIsCrm ? [labelOf(singleKey)] : [connectedCrmLabel, labelOf(singleKey)]).map((l) => (
                <span key={l} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{l}</span>
              ))}
            </h2>
          }
        >
          <BlockDataTable
            title="Chiffre d'affaires"
            subtitle={singleIsCrm ? `deals · ${labelOf(singleKey)}` : `deals (${connectedCrmLabel}) × invoices (${labelOf(singleKey)})`}
            team="finance"
            unit="currency"
            nameLabel="Indicateur"
            extraColumns={["Détail"]}
            rows={
              singleIsCrm
                ? [
                    { name: "CA signé (deals gagnés)", value: singleCa.caSigne > 0 ? Math.round(singleCa.caSigne) : null, unit: "currency" as const, cells: [`${fmt(singleCa.dealsGagnesCount)} deals gagnés (${labelOf(singleKey)})`], spec: { entity: "deals", groupBy: "outcome", measure: "sum" as const, field: "amount", target: "Gagnés" } },
                    { name: "Pipeline pondéré", value: singleCa.pipelinePondere > 0 ? singleCa.pipelinePondere : null, unit: "currency" as const, cells: ["Deals en cours × probabilité"], spec: { entity: "deals", groupBy: "status", measure: "weighted" as const, field: "amount", target: "En cours" } },
                  ]
                : [
                    { name: "CA signé (deals gagnés)", value: singleCa.caSigne > 0 ? Math.round(singleCa.caSigne) : null, unit: "currency" as const, cells: [`${fmt(singleCa.dealsGagnesCount)} deals gagnés (${connectedCrmLabel})`], spec: { entity: "deals", groupBy: "outcome", measure: "sum" as const, field: "amount", target: "Gagnés" } },
                    { name: "CA encaissé", value: singleCa.caEncaisse > 0 ? Math.round(singleCa.caEncaisse) : null, unit: "currency" as const, cells: [`Factures payées (${labelOf(singleKey)})`], spec: { entity: "invoices", groupBy: "status", measure: "sum" as const, field: "amount_paid" } },
                    { name: "Écart signé vs encaissé", value: singleCa.caSigne > 0 || singleCa.caEncaisse > 0 ? Math.round(singleCa.ecartSigneEncaisse) : null, unit: "currency" as const, tone: "auto" as const, cells: ["Deals gagnés jamais facturés / encaissés"] },
                  ]
            }
            sources={singleIsCrm ? [] : [singleKey]}
            footnote={
              singleIsCrm
                ? "CA signé : somme des deals gagnés du CRM — la facturation vit sur les pages des outils de facturation."
                : `Réconciliation du CA : signé côté ${connectedCrmLabel}, encaissé côté ${labelOf(singleKey)} uniquement.`
            }
          />

          {/* CA signé par mois + cumul — uniquement sur la page du CRM */}
          {singleIsCrm && dealsSeries && dealsSeries.wonMonthly.length > 1 && (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">CA signé par mois</p>
                <p className="mb-2 text-[10px] text-slate-400">Deals gagnés · 12 derniers mois ({labelOf(singleKey)})</p>
                <SimpleBarsChart points={dealsSeries.wonMonthly} color="#10b981" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Cumul du CA signé</p>
                <p className="mb-2 text-[10px] text-slate-400">Progression cumulée sur la période</p>
                <TresoLineChart points={dealsSeries.wonCumul} />
              </div>
            </div>
          )}
        </CollapsibleBlock>
        </RemovableBlock>
      )}

      {/* ── 1 outil : SES blocs — conditionnés aux DONNÉES RÉELLES, pas aux
             capacités théoriques (HubSpot sans module facturation actif ne doit
             pas afficher une Synthèse Facturation vide). ── */}
      {singleTool && billingResults.map(({ key, data }) => {
        const label = labelOf(key);
        const showSubs = capabilitiesOf(key).includes("subscriptions") && data.subscriptions.length > 0;
        const showInvoices = data.invoices.length > 0;
        return (
          <div key={key} className="space-y-6">
            {showSubs && !custom.hiddenBlocks.has(`subs_${key}`) && (
              <RemovableBlock pageKey="audit_paiement_facturation" blockKey={`subs_${key}`} label={`Synthèse Revenue récurrent (${label})`}>
              <CollapsibleBlock
                title={
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    Synthèse Revenue récurrent
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{label}</span>
                  </h2>
                }
              >
                <BlockDataTable
                  title={`Synthèse Revenue récurrent (${label})`}
                  subtitle={`subscriptions · ${label}`}
                  team="finance"
                  unit="currency"
                  nameLabel="Indicateur"
                  extraColumns={["Détail"]}
                  rows={[
                    { name: "MRR", value: data.mrr > 0 ? data.mrr : null, unit: "currency" as const, cells: ["Mensuel récurrent"], spec: { entity: "subscriptions", groupBy: "status", measure: "sum" as const, field: "mrr", target: "active" } },
                    { name: "ARR", value: data.arr > 0 ? data.arr : null, unit: "currency" as const, cells: ["Annualisé (MRR × 12)"], spec: { entity: "subscriptions", groupBy: "status", measure: "sum" as const, field: "mrr", target: "active", multiplier: 12 } },
                    { name: "Subscriptions actives", value: data.activeSubsCount, unit: "count" as const, cells: [`sur ${fmt(data.subscriptions.length)}`], spec: { entity: "subscriptions", groupBy: "status", measure: "count" as const, target: "active" } },
                    { name: "Taux de churn", value: data.churnRate ?? null, unit: "percent", cells: ["Annulés / total subs"] },
                  ]}
                  footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
                />
              </CollapsibleBlock>
              </RemovableBlock>
            )}

            {showInvoices && !custom.hiddenBlocks.has(`invoices_${key}`) && (
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey={`invoices_${key}`} label={`Synthèse Facturation (${label})`}>
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Synthèse Facturation
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{label}</span>
                </h2>
              }
            >
              <BlockDataTable
                title={`Synthèse Facturation (${label})`}
                subtitle={`invoices · ${label}`}
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "Factures émises", value: data.invoices.length, unit: "count" as const, cells: ["—"], spec: { entity: "invoices", groupBy: "status", measure: "count" as const } },
                  { name: "Encaissé", value: data.totalPaid > 0 ? data.totalPaid : null, unit: "currency" as const, cells: [`${fmt(data.paidInvoicesCount)} payées`], spec: { entity: "invoices", groupBy: "status", measure: "sum" as const, field: "amount_paid" } },
                  { name: "Factures impayées", value: data.unpaidInvoicesCount, unit: "count", cells: [data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : "—"] },
                  { name: "Montant moyen", value: data.avgInvoice != null && data.avgInvoice > 0 ? data.avgInvoice : null, unit: "currency", cells: ["Par facture émise"] },
                ]}
                footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
              />
            </CollapsibleBlock>
            </RemovableBlock>
            )}
          </div>
        );
      })}

      {/* ── 1 outil : trésorerie (capacité cashflow — Pennylane & co) ── */}
      {singleTool && cashflowResults.map(({ key, cf }) => {
        const label = labelOf(key);
        if (custom.hiddenBlocks.has(`cashflow_${key}`)) return null;
        return (
          <RemovableBlock key={`cf-${key}`} pageKey="audit_paiement_facturation" blockKey={`cashflow_${key}`} label={`Trésorerie (${label})`}>
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Trésorerie
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">{label}</span>
              </h2>
            }
          >
            <BlockDataTable
              title={`Trésorerie (${label})`}
              subtitle={`cashflow · ${label}`}
              team="finance"
              unit="currency"
              nameLabel="Indicateur"
              extraColumns={["Détail"]}
              rows={[
                { name: "Encaissements", value: cf.encaissementsTotal > 0 ? Math.round(cf.encaissementsTotal) : null, unit: "currency" as const, tone: "pos" as const, cells: ["Flux entrants synchronisés (TTC)"], spec: { entity: "transactions", groupBy: "direction", measure: "sum" as const, field: "amount_in" } },
                { name: "Décaissements", value: cf.hasOutflows ? Math.round(cf.decaissementsTotal) : null, unit: "currency" as const, tone: "neg" as const, cells: [cf.hasOutflows ? "Flux sortants synchronisés (TTC)" : "Aucun flux sortant synchronisé"], spec: { entity: "transactions", groupBy: "direction", measure: "sum" as const, field: "amount_out" } },
                { name: "Balance", value: cf.hasData ? Math.round(cf.balance) : null, unit: "currency" as const, tone: "auto" as const, cells: ["Encaissements − décaissements"], spec: { entity: "transactions", groupBy: "direction", measure: "sum" as const, field: "amount" } },
                { name: "Balance du mois en cours", value: cf.balanceMoisCourant, unit: "currency", tone: "auto", cells: ["Encaissé − décaissé ce mois-ci (mois partiel)"] },
                { name: "Charges fixes mensuelles", value: cf.chargesFixesMensuelles != null ? Math.round(cf.chargesFixesMensuelles) : null, unit: "currency", tone: "neg", cells: ["Médiane des décaissements (6 mois)"] },
                { name: cf.balanceSource === "bank" ? "Trésorerie disponible" : "Trésorerie disponible (estimée)", value: cf.tresorerieDisponible != null ? Math.round(cf.tresorerieDisponible) : null, unit: "currency", tone: "auto", cells: [cf.balanceSource === "bank" ? "Solde réel des comptes bancaires (TTC)" : "Cumul TTC des flux synchronisés"] },
                { name: "Trésorerie consolidée", value: cf.tresorerieConsolidee != null ? Math.round(cf.tresorerieConsolidee) : null, unit: "currency", tone: "auto", cells: ["Disponible + placements"] },
                { name: "Runway", value: cf.runwayMois, unit: "count", cells: ["Mois sans nouveau revenu (dispo / charges fixes)"] },
              ]}
              footnote={cf.balanceSource === "bank"
                ? "Trésorerie disponible = solde réel des comptes bancaires au moment de la dernière synchronisation."
                : "Trésorerie estimée depuis les flux synchronisés — pas un solde bancaire en temps réel."}
            />

            {/* ── Graphiques : évolution du solde + flux mensuels ── */}
            {cf.balanceSeries.length > 1 && (
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-800">Évolution de la trésorerie</p>
                  <p className="mb-2 text-[10px] text-slate-400">
                    Solde mois par mois{cf.balanceSource === "bank" ? " — ancré sur le solde bancaire réel" : " — estimé depuis les flux"} · {label}
                  </p>
                  <TresoLineChart points={cf.balanceSeries} />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-800">Encaissements vs décaissements</p>
                  <p className="mb-2 text-[10px] text-slate-400">Flux mensuels TTC (12 derniers mois) · {label}</p>
                  <TresoFlowsChart points={cf.monthlyFlows} />
                </div>
              </div>
            )}

            {/* Ventilation des charges par catégorie (catégorisation Pennylane) */}
            {cf.chargesParCategorie.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-800">Répartition des charges</p>
                  <p className="mb-3 text-[10px] text-slate-400">Décaissements par catégorie · {label}</p>
                  <HBarChart
                    unit="currency"
                    colorize
                    items={cf.chargesParCategorie.map((c) => ({ label: c.label, value: Math.round(c.total) }))}
                  />
                </div>
                <BlockDataTable
                  title={`Répartition des charges (${label})`}
                  subtitle={`catégories · ${label}`}
                  team="finance"
                  unit="currency"
                  nameLabel="Catégorie"
                  extraColumns={["Transactions"]}
                  rows={cf.chargesParCategorie.map((c) => ({
                    name: c.label,
                    value: c.total,
                    unit: "currency" as const,
                    cells: [c.count > 0 ? fmt(c.count) : "—"],
                  }))}
                  footnote={
                    cf.pctChargesNonCategorisees != null && cf.pctChargesNonCategorisees > 0
                      ? `${cf.pctChargesNonCategorisees} % des décaissements ne sont pas encore catégorisés dans ${label} — catégorise-les pour affiner l'analyse.`
                      : `Ventilation des décaissements selon la catégorisation ${label}.`
                  }
                />
              </div>
            )}
          </CollapsibleBlock>
          </RemovableBlock>
        );
      })}

      {/* ── Vues croisées (deals + invoices) : tuiles cockpit puis blocs segmentés
             par objectif d'analyse — CA, marge, prévisions. Pas de titre
             « Croisement » : la sélection multi-sources le dit déjà. ── */}
      {margin && (() => {
        // Pastilles par bloc = les outils qui alimentent RÉELLEMENT ce bloc
        // (pas toute la sélection : l'encaissé vient d'UN outil de facturation).
        const caChips = chipLabels([crmKey, billingUsedKey]);
        const margeChips = chipLabels([billingUsedKey, cashflowUsedKey]);
        const prevChips = chipLabels([crmKey, billingUsedKey, cashflowUsedKey]);
        const chip = (l: string) => (
          <span key={l} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{l}</span>
        );

        return (
          <div className="space-y-6">
            {/* ── Chiffre d'affaires : réconciliation signé (CRM) vs encaissé (facturation) ── */}
            {!custom.hiddenBlocks.has("cross_ca") && (
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey="cross_ca" label="Chiffre d'affaires">
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Chiffre d&apos;affaires
                  {caChips.map(chip)}
                </h2>
              }
            >
              <BlockDataTable
                title="Chiffre d'affaires"
                subtitle="deals × invoices"
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "CA signé (deals gagnés)", value: margin.caSigne > 0 ? Math.round(margin.caSigne) : null, unit: "currency" as const, cells: [`${fmt(margin.dealsGagnesCount)} deals gagnés (CRM)`], spec: { entity: "deals", groupBy: "outcome", measure: "sum" as const, field: "amount", target: "Gagnés" } },
                  { name: "CA encaissé", value: margin.caEncaisse > 0 ? Math.round(margin.caEncaisse) : null, unit: "currency" as const, cells: ["Factures payées (facturation)"], spec: { entity: "invoices", groupBy: "status", measure: "sum" as const, field: "amount_paid" } },
                  { name: "Écart signé vs encaissé", value: margin.caSigne > 0 || margin.caEncaisse > 0 ? Math.round(margin.ecartSigneEncaisse) : null, unit: "currency", tone: "auto", cells: ["Deals gagnés jamais facturés / encaissés"] },
                ]}
                footnote="Réconciliation du CA : ce que le CRM a signé vs ce que la facturation a réellement encaissé."
              />

              {/* CA signé par mois + cumul — lecture cockpit de la dynamique de signature */}
              {dealsSeries && dealsSeries.wonMonthly.length > 1 && (
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-800">CA signé par mois</p>
                    <p className="mb-2 text-[10px] text-slate-400">Deals gagnés · 12 derniers mois (CRM)</p>
                    <SimpleBarsChart points={dealsSeries.wonMonthly} color="#10b981" />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-800">Cumul du CA signé</p>
                    <p className="mb-2 text-[10px] text-slate-400">Progression cumulée sur la période</p>
                    <TresoLineChart points={dealsSeries.wonCumul} />
                  </div>
                </div>
              )}
            </CollapsibleBlock>
            </RemovableBlock>
            )}

            {/* ── Marge : rentabilité réelle sur l'encaissé ── */}
            {!custom.hiddenBlocks.has("cross_marge") && (
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey="cross_marge" label="Marge">
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Marge
                  {margeChips.map(chip)}
                </h2>
              }
            >
              <BlockDataTable
                title="Marge"
                subtitle="invoices × cashflow"
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "Décaissements", value: margin.decaissements != null ? Math.round(margin.decaissements) : null, unit: "currency" as const, tone: "neg" as const, cells: [margin.decaissements != null ? "Flux sortants synchronisés" : "Sync fournisseurs requise"], spec: { entity: "transactions", groupBy: "direction", measure: "sum" as const, field: "amount_out" } },
                  { name: "Marge brute", value: margin.margeBrute != null ? Math.round(margin.margeBrute) : null, unit: "currency", tone: "auto", cells: [margin.margeBrute != null ? "CA encaissé − décaissements" : "Décaissements requis (sync fournisseurs)"] },
                  { name: "Taux de marge", value: margin.tauxMarge, unit: "percent", tone: "auto", cells: ["Marge / CA encaissé"] },
                ]}
                footnote="Marge brute = CA encaissé (facturation) − décaissements (trésorerie). Les deux flux viennent d'outils différents : c'est le croisement qui rend la marge calculable."
              />

              {/* Marge mensuelle en courbe — flux réels encaissés − décaissés */}
              {margeMensuelle.length > 1 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-800">Marge mensuelle</p>
                  <p className="mb-2 text-[10px] text-slate-400">
                    Encaissements − décaissements du mois (flux réels TTC, 12 derniers mois)
                  </p>
                  <TresoLineChart points={margeMensuelle} />
                </div>
              )}
            </CollapsibleBlock>
            </RemovableBlock>
            )}

            {/* ── Prévisions : projection du pipeline au taux de marge courant ── */}
            {!custom.hiddenBlocks.has("cross_previsions") && (
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey="cross_previsions" label="Prévisions">
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Prévisions
                  {prevChips.map(chip)}
                </h2>
              }
            >
              <BlockDataTable
                title="Prévisions"
                subtitle="pipeline × taux de marge"
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "Pipeline pondéré", value: margin.pipelinePondere > 0 ? margin.pipelinePondere : null, unit: "currency" as const, cells: ["Deals en cours × probabilité"], spec: { entity: "deals", groupBy: "status", measure: "weighted" as const, field: "amount", target: "En cours" } },
                  { name: "Prévision de marge", value: margin.previsionMarge, unit: "currency", cells: ["Pipeline pondéré × taux de marge"] },
                ]}
                footnote="Projection : la prévision applique le taux de marge courant au pipeline pondéré du CRM."
              />

              {/* Projection 12 mois en courbes — 3 scénarios (cockpit Lomed) */}
              {forecast?.hasData && forecast.points.length > 1 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-800">
                    Projection de trésorerie · 12 mois
                  </p>
                  <p className="mb-2 text-[10px] text-slate-400">
                    Prudent = factures ouvertes seules · Probable = + pipeline pondéré · Ambitieux = + pipeline plein —
                    détail complet dans l&apos;onglet Prévisionnel
                  </p>
                  <ForecastChart
                    points={forecast.points.map((p) => ({ label: p.label, prudent: p.soldePrudent, probable: p.soldeProbable, ambitieux: p.soldeAmbitieux }))}
                  />
                </div>
              )}
            </CollapsibleBlock>
            </RemovableBlock>
            )}
          </div>
        );
      })()}

      {selectedKeys.length > 0 && !anyData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune donnée trouvée dans {selectedKeys.map(labelOf).join(" + ")}.
            {switchableTools.length > 1
              ? " Ajuste les sources via « Sources des blocs » ci-dessous, ou lance une synchronisation depuis Intégrations → Mes outils."
              : " Activez HubSpot Invoices/Payments ou connectez Stripe / Pennylane pour alimenter cette page automatiquement."}
          </p>
        </div>
      )}

      {/* ROI : relances d'impayés suivies → cash récupéré attribué (en euros). */}
      <CashRecoveryBlock />

      {/* Santé de réconciliation : score + tendance + le lignage deal → facture
          → encaissement, avec l'écart NET vs BRUT (compensation révélée). */}
      <ReconciliationHealthCard supabase={supabase} orgId={orgId} />

      {/* Réconciliation au niveau du DEAL (le croisement CRM × facturation que
          la compta ne fait pas) : chaque deal gagné relié à SES factures,
          écart signé − facturé deal par deal. L'encaissement, lui, vient du
          lettrage natif de la compta (amount_paid) — pas de doublon. */}
      <DealInvoiceLinks />

      {/* Ventilation par établissement (facette SIRET) : une même entité légale
          qui facture depuis plusieurs SIRET → CA ventilé par site, sans
          dé-consolider le compte. Ne s'affiche que si ≥ 1 entité multi-SIRET. */}
      <EstablishmentBreakdown supabase={supabase} orgId={orgId} />

      {/* File d'apurement : les écarts signé ↔ facturé statués entreprise par
          entreprise (justifié / à corriger / corrigé), export CSV. */}
      <GapReviewQueue />

      <PageDataTables pageKey="audit_paiement_facturation" />

      {/* Sources des blocs — rappel discret en bas de page (les sources sont
          pilotées par les Paramètres). Pas de raccourcis croisés « A × B » ici :
          ces KPIs arriveront via les suggestions d'ajout/retrait de blocs. */}
      <SourceToolSwitcher
        mode="multi"
        tools={switchableTools.map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }))}
        activeKeys={selectedKeys}
        defaultOpen={selectedKeys.length === 0}
        hint="Une option à la fois : un outil affiche ses blocs ; sélectionner deux outils dans les Paramètres affiche leurs vues croisées."
      />
    </section>
  );
}
