export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import {
  getSwitchableBillingTools,
  validateSourceParam,
  validateSourcesParam,
  capabilitiesOf,
  availableCrossViews,
  availableCrossCombos,
} from "@/lib/audit/source-switch";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { fetchPaiementFacturationFor, fmt, fmtK, type PaiementFacturationData } from "@/lib/audit/paiement-facturation-data";
import { computeCashflow } from "@/lib/audit/cashflow";
import { computeCrossMargin } from "@/lib/audit/cross-margin";
import { TresoLineChart, TresoFlowsChart } from "@/components/charts/treso-charts";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { KpiStatTiles, type StatTile } from "@/components/kpi-stat-tiles";
import { SourceToolSwitcher } from "@/components/source-tool-switcher";

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
  // AUCUN outil présélectionné : zéro sélection = état neutre. Les blocs et
  // leurs tables s'activent quand l'utilisateur choisit ses sources — 1 clic
  // direct, jamais de désélection préalable d'un outil imposé.

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

      {/* Sources des blocs : sélection multiple → la page se recompose selon les capacités */}
      <SourceToolSwitcher
        mode="multi"
        tools={switchableTools.map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }))}
        activeKeys={selectedKeys}
        combos={availableCrossCombos(switchableTools)}
        hint="Une option à la fois : un outil affiche ses blocs, une option croisée « A × B » affiche les vues croisées (ex : marge CRM × facturation)."
      />

      {/* ── 0 outil : invite — rien ne s'affiche tant qu'aucune source n'est choisie ── */}
      {selectedKeys.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Choisis ta source ci-dessus pour activer les blocs.</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Un outil affiche ses propres indicateurs ; une option croisée « A × B » affiche
            les croisements entre outils (ex : marge CRM × facturation).
          </p>
        </div>
      )}

      {selectedKeys.length > 0 && (
        <InsightLockedBlock
          previewTitle={`Analyse IA paiements & facturation (score ${scoreData?.score ?? 0}/100)`}
          previewBody="L'IA Revold détecte les risques de défaut de paiement, optimise le recouvrement et identifie les patterns de churn liés à la facturation."
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

      {/* ── 1 outil : SES blocs — conditionnés aux DONNÉES RÉELLES, pas aux
             capacités théoriques (HubSpot sans module facturation actif ne doit
             pas afficher une Synthèse Facturation vide). ── */}
      {singleTool && billingResults.map(({ key, data }) => {
        const label = labelOf(key);
        const showSubs = capabilitiesOf(key).includes("subscriptions") && data.subscriptions.length > 0;
        const showInvoices = data.invoices.length > 0;
        return (
          <div key={key} className="space-y-6">
            {showSubs && (
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
                    { name: "MRR", value: data.mrr > 0 ? data.mrr : null, unit: "currency", cells: ["Mensuel récurrent"] },
                    { name: "ARR", value: data.arr > 0 ? data.arr : null, unit: "currency", cells: ["Annualisé (MRR × 12)"] },
                    { name: "Subscriptions actives", value: data.activeSubsCount, unit: "count", cells: [`sur ${fmt(data.subscriptions.length)}`] },
                    { name: "Taux de churn", value: data.churnRate ?? null, unit: "percent", cells: ["Annulés / total subs"] },
                  ]}
                  footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
                />
              </CollapsibleBlock>
            )}

            {showInvoices && (
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
                  { name: "Factures émises", value: data.invoices.length, unit: "count", cells: ["—"] },
                  { name: "Encaissé", value: data.totalPaid > 0 ? data.totalPaid : null, unit: "currency", cells: [`${fmt(data.paidInvoicesCount)} payées`] },
                  { name: "Factures impayées", value: data.unpaidInvoicesCount, unit: "count", cells: [data.totalUnpaidAmount > 0 ? fmtK(data.totalUnpaidAmount) : "—"] },
                  { name: "Montant moyen", value: data.avgInvoice != null && data.avgInvoice > 0 ? data.avgInvoice : null, unit: "currency", cells: ["Par facture émise"] },
                ]}
                footnote="Indicateurs d'unités différentes : l'alerte porte sur une ligne précise, jamais sur un total."
              />
            </CollapsibleBlock>
            )}
          </div>
        );
      })}

      {/* ── 1 outil : trésorerie (capacité cashflow — Pennylane & co) ── */}
      {singleTool && cashflowResults.map(({ key, cf }) => {
        const label = labelOf(key);
        return (
          <CollapsibleBlock
            key={`cf-${key}`}
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
                { name: "Encaissements", value: cf.encaissementsTotal > 0 ? Math.round(cf.encaissementsTotal) : null, unit: "currency", tone: "pos", cells: ["Flux entrants synchronisés (TTC)"] },
                { name: "Décaissements", value: cf.hasOutflows ? Math.round(cf.decaissementsTotal) : null, unit: "currency", tone: "neg", cells: [cf.hasOutflows ? "Flux sortants synchronisés (TTC)" : "Aucun flux sortant synchronisé"] },
                { name: "Balance", value: cf.hasData ? Math.round(cf.balance) : null, unit: "currency", tone: "auto", cells: ["Encaissements − décaissements"] },
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
              <div className="mt-4">
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
        );
      })}

      {/* ── Vues croisées (deals + invoices) : tuiles cockpit puis blocs segmentés
             par objectif d'analyse — CA, marge, prévisions. Pas de titre
             « Croisement » : la sélection multi-sources le dit déjà. ── */}
      {margin && (() => {
        const srcLabel = selectedKeys.map(labelOf).join(" × ");
        const srcPill = (
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-600">
            {srcLabel}
          </span>
        );
        const eur = (n: number) =>
          new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

        const tiles: StatTile[] = [
          {
            label: "CA signé",
            value: margin.caSigne > 0 ? eur(margin.caSigne) : "—",
            tone: "neutral",
            sub: `${fmt(margin.dealsGagnesCount)} deals gagnés (CRM)`,
          },
          {
            label: "CA encaissé",
            value: margin.caEncaisse > 0 ? eur(margin.caEncaisse) : "—",
            tone: "accent",
            sub: "Factures payées (facturation)",
            verdict: margin.caSigne > 0
              ? margin.ecartSigneEncaisse > 0
                ? { label: `${eur(margin.ecartSigneEncaisse)} signés non encaissés`, tone: "warn" }
                : { label: "Tout le signé est encaissé", tone: "pos" }
              : undefined,
          },
          {
            label: "Taux de marge",
            value: margin.tauxMarge != null ? `${margin.tauxMarge} %` : "—",
            tone: margin.tauxMarge == null ? "neutral" : margin.tauxMarge >= 40 ? "pos" : margin.tauxMarge >= 25 ? "accent" : "neg",
            sub: "Marge brute / CA encaissé",
            verdict: margin.tauxMarge == null ? undefined
              : margin.tauxMarge >= 40 ? { label: "Excellent (> 40 %)", tone: "pos" }
              : margin.tauxMarge >= 25 ? { label: "Correct", tone: "warn" }
              : { label: "Faible (< 25 %)", tone: "neg" },
          },
          {
            label: "Prévision de marge",
            value: margin.previsionMarge != null ? eur(margin.previsionMarge) : "—",
            tone: "neutral",
            sub: "Pipeline pondéré × taux de marge",
          },
        ];

        return (
          <div className="space-y-6">
            <KpiStatTiles tiles={tiles} />

            {/* ── Chiffre d'affaires : réconciliation signé (CRM) vs encaissé (facturation) ── */}
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Chiffre d&apos;affaires
                  {srcPill}
                </h2>
              }
            >
              <BlockDataTable
                title={`Chiffre d'affaires (${srcLabel})`}
                subtitle="deals × invoices"
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "CA signé (deals gagnés)", value: margin.caSigne > 0 ? Math.round(margin.caSigne) : null, unit: "currency", cells: [`${fmt(margin.dealsGagnesCount)} deals gagnés (CRM)`] },
                  { name: "CA encaissé", value: margin.caEncaisse > 0 ? Math.round(margin.caEncaisse) : null, unit: "currency", cells: ["Factures payées (facturation)"] },
                  { name: "Écart signé vs encaissé", value: margin.caSigne > 0 || margin.caEncaisse > 0 ? Math.round(margin.ecartSigneEncaisse) : null, unit: "currency", tone: "auto", cells: ["Deals gagnés jamais facturés / encaissés"] },
                ]}
                footnote="Réconciliation du CA : ce que le CRM a signé vs ce que la facturation a réellement encaissé."
              />
            </CollapsibleBlock>

            {/* ── Marge : rentabilité réelle sur l'encaissé ── */}
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Marge
                  {srcPill}
                </h2>
              }
            >
              <BlockDataTable
                title={`Marge (${srcLabel})`}
                subtitle="invoices × cashflow"
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "Décaissements", value: margin.decaissements != null ? Math.round(margin.decaissements) : null, unit: "currency", tone: "neg", cells: [margin.decaissements != null ? "Flux sortants synchronisés" : "Sync fournisseurs requise"] },
                  { name: "Marge brute", value: margin.margeBrute != null ? Math.round(margin.margeBrute) : null, unit: "currency", tone: "auto", cells: [margin.margeBrute != null ? "CA encaissé − décaissements" : "Décaissements requis (sync fournisseurs)"] },
                  { name: "Taux de marge", value: margin.tauxMarge, unit: "percent", tone: "auto", cells: ["Marge / CA encaissé"] },
                ]}
                footnote="Marge brute = CA encaissé (facturation) − décaissements (trésorerie). Les deux flux viennent d'outils différents : c'est le croisement qui rend la marge calculable."
              />
            </CollapsibleBlock>

            {/* ── Prévisions : projection du pipeline au taux de marge courant ── */}
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Prévisions
                  {srcPill}
                </h2>
              }
            >
              <BlockDataTable
                title={`Prévisions (${srcLabel})`}
                subtitle="pipeline × taux de marge"
                team="finance"
                unit="currency"
                nameLabel="Indicateur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "Pipeline pondéré", value: margin.pipelinePondere > 0 ? margin.pipelinePondere : null, unit: "currency", cells: ["Deals en cours × probabilité"] },
                  { name: "Prévision de marge", value: margin.previsionMarge, unit: "currency", cells: ["Pipeline pondéré × taux de marge"] },
                ]}
                footnote="Projection : la prévision applique le taux de marge courant au pipeline pondéré du CRM."
              />
            </CollapsibleBlock>
          </div>
        );
      })()}

      {selectedKeys.length > 0 && !anyData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune donnée trouvée dans {selectedKeys.map(labelOf).join(" + ")}.
            {switchableTools.length > 1
              ? " Ajuste les sources ci-dessus, ou lance une synchronisation depuis Intégrations → Mes outils."
              : " Activez HubSpot Invoices/Payments ou connectez Stripe / Pennylane pour alimenter cette page automatiquement."}
          </p>
        </div>
      )}

      <PageDataTables pageKey="audit_paiement_facturation" />
    </section>
  );
}
