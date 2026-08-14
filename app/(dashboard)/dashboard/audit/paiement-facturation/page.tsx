export const dynamic = "force-dynamic";

import Link from "next/link";
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
import { computeBillingRadar, computeWonToInvoiceDetail } from "@/lib/audit/billing-radar";
import { TresoLineChart, TresoFlowsChart, SimpleBarsChart } from "@/components/charts/treso-charts";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { HBarChart } from "@/components/charts/hbar-chart";
import { CreateInvoiceTaskButton } from "@/components/billing/create-invoice-task-button";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { SourceToolSwitcher } from "@/components/source-tool-switcher";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";

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

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "audit_paiement_facturation");

  // ── Radar de facturation : factures attendues (rythme observé / fin de
  //    contrat CRM mappée) non émises — l'amont du taux de recouvrement. ──
  const radar = await computeBillingRadar(supabase, orgId);

  // ── Du closing à la 1re facture : délai réel gagné → facturation (la
  //    close_date remonte automatiquement au passage en « gagné »), chaîne
  //    complète jusqu'à l'encaissement + ventilation par owner. ──
  const wonToInvoice = await computeWonToInvoiceDetail(supabase, orgId, token);

  // ── Séries pour les graphes de la vue croisée (style cockpit Lomed) :
  //    CA signé par mois, marge mensuelle et projection 12 mois. ──
  const dealsSeries = margin ? await computeDealsSeries(supabase, orgId) : null;
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
          raw: margin.caSigne > 0 ? Math.round(margin.caSigne) : null,
          rawUnit: "currency",
          tone: "neutral",
          sub: `${fmt(margin.dealsGagnesCount)} deals gagnés (CRM)`,
        },
        {
          key: "ca_encaisse",
          label: "CA encaissé",
          value: margin.caEncaisse > 0 ? eur(margin.caEncaisse) : "—",
          raw: margin.caEncaisse > 0 ? Math.round(margin.caEncaisse) : null,
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
          hiddenBlocks={hiddenBlockList(custom, (key) => {
            if (key.startsWith("subs_")) return { view: "table", description: "MRR, ARR, abonnements actifs, churn" };
            if (key.startsWith("invoices_")) return { view: "table", description: "Factures émises, encaissé, impayés, montant moyen" };
            if (key.startsWith("cashflow_")) return { view: "chart-line", description: "Trésorerie : flux, solde, runway + graphiques et charges" };
            if (key === "cross_ca") return { view: "table", description: "CA signé vs encaissé (réconciliation CRM × facturation)" };
            if (key === "cross_marge") return { view: "table", description: "Marge brute et taux de marge (encaissé − décaissements)" };
            if (key === "cross_previsions") return { view: "table", description: "Prévision de marge (pipeline pondéré × taux de marge)" };
            return undefined;
          })}
        />
      )}

      {/* ── RADAR DE FACTURATION : factures attendues non émises — l'échéance
             est passée et personne n'a facturé (rythme observé / fin de
             contrat CRM mappée). L'amont du taux de recouvrement. ── */}
      {radar.hasData && selectedKeys.length > 0 && !custom.hiddenBlocks.has("billing_radar") && (
        <RemovableBlock pageKey="audit_paiement_facturation" blockKey="billing_radar" label="Radar de facturation">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Radar de facturation
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Factures ATTENDUES mais non émises — détectées par le rythme de facturation réel de chaque
                  client ({radar.regularCount}/{radar.analyzed} clients au rythme établi) et par la date de fin
                  de contrat mappée depuis le CRM.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums ${radar.overdue.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {radar.overdue.length}
                </p>
                <p className="text-[10px] text-slate-400">
                  en retard{radar.overdueAmount > 0 ? ` · ${eur(radar.overdueAmount)} en attente` : ""}
                </p>
              </div>
            </div>

            {radar.overdue.length === 0 && radar.upcoming.length === 0 && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                ✓ Aucune facture attendue en retard, aucune échéance sous 30 jours.
              </p>
            )}

            {radar.overdue.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100">
                {radar.overdue.map((it) => (
                  <li key={`o-${it.companyId}`} className="py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{it.companyName}</span>
                      <span className="text-[11px] font-bold tabular-nums text-rose-600">
                        {it.daysLate} j de retard{it.usualAmount ? ` · ~${eur(it.usualAmount)}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Facture attendue le {new Date(it.expectedDate).toLocaleDateString("fr-FR")} — base : {it.basisLabel}.
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-700">
                      <span aria-hidden>💡</span> À facturer maintenant{it.usualAmount ? ` (~${eur(it.usualAmount)} de trésorerie en attente)` : ""} — vérifie dans Pennylane/Stripe puis relance le owner.
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {radar.upcoming.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">À facturer sous 30 jours</p>
                <ul className="mt-1.5 space-y-1">
                  {radar.upcoming.map((it) => (
                    <li key={`u-${it.companyId}`} className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-medium text-slate-700">{it.companyName}</span>
                      <span className="tabular-nums text-slate-500">
                        dans {it.daysUntil} j ({new Date(it.expectedDate).toLocaleDateString("fr-FR")})
                        {it.usualAmount ? ` · ~${eur(it.usualAmount)}` : ""} · {it.basisLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Couverture opt-in de la date de contrat — jamais exigée. */}
            <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
              Date de fin de contrat renseignée sur {radar.contractCoverage.filled}/{radar.contractCoverage.total} clients
              facturés — mappe tes propriétés « date de début / fin de contrat » (Company et/ou Deal) dans{" "}
              <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-fuchsia-600 hover:underline">
                Paramètres → Modèle de données
              </Link>{" "}
              pour affiner le radar. Alerte disponible : ajoute la tuile « Factures attendues en retard » puis sa cloche.
            </p>
          </div>
        </RemovableBlock>
      )}

      {/* ── DU CLOSING À LA 1RE FACTURE : le délai réel gagné → facturation,
             mesuré deal par deal (close_date automatique au passage en gagné
             × factures Pennylane/Stripe), avec la fuite en cours. ── */}
      {wonToInvoice.hasData && selectedKeys.length > 0 && !custom.hiddenBlocks.has("won_to_invoice") && (
        <RemovableBlock pageKey="audit_paiement_facturation" blockKey="won_to_invoice" label="Du closing à la 1re facture">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Du closing à la 1re facture
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Délai réel entre le passage d&apos;un deal en « gagné » (date de closing synchronisée
                  automatiquement) et sa première facture — mesuré deal par deal sur tes vraies factures.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {wonToInvoice.medianDelay != null ? `${wonToInvoice.medianDelay} j` : "—"}
                </p>
                <p className="text-[10px] text-slate-400">
                  délai médian · {wonToInvoice.sample} deal{wonToInvoice.sample > 1 ? "s" : ""} mesuré{wonToInvoice.sample > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Chaîne complète : gagné → facturé → encaissé (cash conversion réel) */}
            {wonToInvoice.chain.toInvoice != null && (
              <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums text-slate-900">{wonToInvoice.chain.toInvoice} j</p>
                  <p className="text-[10px] text-slate-400">gagné → facturé</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {wonToInvoice.chain.toPaid != null ? `${wonToInvoice.chain.toPaid} j` : "—"}
                  </p>
                  <p className="text-[10px] text-slate-400">facturé → encaissé</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums text-indigo-600">
                    {wonToInvoice.chain.total != null ? `${wonToInvoice.chain.total} j` : "—"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    cycle cash total{wonToInvoice.chain.samplePaid > 0 ? ` (${wonToInvoice.chain.samplePaid} mesurés)` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Ventilation par owner : qui déclenche la facturation en retard ? */}
            {wonToInvoice.byOwner.length > 1 && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Délai de facturation par owner</p>
                <p className="mb-3 text-[10px] text-slate-400">
                  Délai médian closing → 1re facture par commercial — matière à coaching pour les retardataires
                </p>
                <HBarChart
                  unit="count"
                  showPct={false}
                  items={wonToInvoice.byOwner.slice(0, 8).map((o) => ({
                    label: `${o.ownerName} (${o.sample} deal${o.sample > 1 ? "s" : ""}${o.unbilledCount > 0 ? ` · ${o.unbilledCount} non facturé${o.unbilledCount > 1 ? "s" : ""}` : ""})`,
                    value: o.medianDelay,
                    color: o.medianDelay > 30 ? "#f43f5e" : o.medianDelay > 10 ? "#f59e0b" : "#10b981",
                  }))}
                />
              </div>
            )}

            {/* Évolution du délai médian par mois de closing */}
            {wonToInvoice.monthly.length > 1 && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Évolution du délai de facturation</p>
                <p className="mb-2 text-[10px] text-slate-400">
                  Délai médian closing → 1re facture, par mois de closing (jours)
                </p>
                <TresoLineChart points={wonToInvoice.monthly} unit="count" />
              </div>
            )}

            {/* Gagnés toujours pas facturés — la fuite en cours */}
            {wonToInvoice.unbilledCount > 0 ? (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                  Gagnés sans facture ({wonToInvoice.unbilledCount}
                  {wonToInvoice.unbilledAmount > 0 ? ` · ${eur(wonToInvoice.unbilledAmount)} non facturés` : ""})
                </p>
                <ul className="mt-1.5 divide-y divide-slate-100">
                  {wonToInvoice.unbilled.map((d, i) => (
                    <li key={`${d.dealName}-${i}`} className="py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {d.companyName} <span className="font-normal text-slate-500">— {d.dealName}</span>
                        </span>
                        <span className="text-[11px] font-bold tabular-nums text-rose-600">
                          {d.daysSince} j sans facture{d.amount ? ` · ${eur(d.amount)}` : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Gagné le {new Date(d.closeDate).toLocaleDateString("fr-FR")} — aucune facture émise depuis.
                      </p>
                      {/* Action human-in-the-loop : tâche HubSpot assignée au owner. */}
                      {d.dealHubspotId && (
                        <div className="mt-1">
                          <CreateInvoiceTaskButton
                            dealHubspotId={d.dealHubspotId}
                            dealName={d.dealName}
                            companyName={d.companyName}
                            ownerId={d.ownerId}
                            amount={d.amount}
                            daysSince={d.daysSince}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                ✓ Tous les deals gagnés (au-delà de 15 jours) ont une facture.
              </p>
            )}

            <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
              Tuiles alertables disponibles via ＋ Ajouter un bloc : « Deal gagné → 1re facture (délai médian) »
              et « Deals gagnés sans facture » (cloche = notification dès qu&apos;un gagné n&apos;est pas facturé).
            </p>
          </div>
        </RemovableBlock>
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
                    { name: "MRR", value: data.mrr > 0 ? data.mrr : null, unit: "currency", cells: ["Mensuel récurrent"] },
                    { name: "ARR", value: data.arr > 0 ? data.arr : null, unit: "currency", cells: ["Annualisé (MRR × 12)"] },
                    { name: "Subscriptions actives", value: data.activeSubsCount, unit: "count", cells: [`sur ${fmt(data.subscriptions.length)}`] },
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
                  { name: "Factures émises", value: data.invoices.length, unit: "count", cells: ["—"] },
                  { name: "Encaissé", value: data.totalPaid > 0 ? data.totalPaid : null, unit: "currency", cells: [`${fmt(data.paidInvoicesCount)} payées`] },
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
        // Pas de pastille sources dans les titres : le rappel « Sources des
        // blocs » en bas de page joue déjà ce rôle.
        const srcLabel = selectedKeys.map(labelOf).join(" × ");

        return (
          <div className="space-y-6">
            {/* ── Chiffre d'affaires : réconciliation signé (CRM) vs encaissé (facturation) ── */}
            {!custom.hiddenBlocks.has("cross_ca") && (
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey="cross_ca" label={`Chiffre d'affaires (${srcLabel})`}>
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Chiffre d&apos;affaires
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
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey="cross_marge" label={`Marge (${srcLabel})`}>
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Marge
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
            <RemovableBlock pageKey="audit_paiement_facturation" blockKey="cross_previsions" label={`Prévisions (${srcLabel})`}>
            <CollapsibleBlock
              title={
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  Prévisions
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
