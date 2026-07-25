export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Page ALIGNEMENT — l'alignement entre les services, mesuré sur les données
 * réelles : marketing → ventes → finance → CS.
 *
 * Chaque bloc est un RELAIS entre deux équipes, avec son délai médian et sa
 * couverture de données. Fiabilité : médiane partout, échantillon affiché,
 * jamais de faux zéro — un relais sans donnée mesurable l'affiche clairement.
 *
 * Câblage : colonnes lifecycle datées de `contacts` (migration 20260725000001,
 * ETL hs_v2_date_entered_*), vraie createdate des deals, et recettes de délai
 * du moteur de réconciliation (mql_to_deal_created, deal_won_to_first_invoice,
 * invoice_to_payment) — les mêmes que les alertes/objectifs peuvent surveiller.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate } from "@/components/page-sources-gate";
import { KpiStatTiles, type StatTile } from "@/components/kpi-stat-tiles";
import { computeReconciledMetric, type ReconResult } from "@/lib/reconciliation/engine";
import {
  fetchAlignmentContacts,
  computeLifecycleVelocity,
  computeMqlHandoff,
  computeRealSalesCycle,
} from "@/lib/alignment/velocity";

const fmtDays = (d: number | null): string => (d == null ? "—" : `${d.toLocaleString("fr-FR")} j`);
const fmtEur = (v: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Tuile délai : valeur + couverture, ou « donnée insuffisante » (anti-faux-0). */
function delayTile(label: string, sub: string, r: ReconResult | null): StatTile {
  if (!r || !r.hasData) {
    return { label, value: "—", tone: "neutral", sub, verdict: { label: "Donnée insuffisante", tone: "warn" } };
  }
  return {
    label,
    value: fmtDays(r.value),
    tone: "accent",
    sub,
    verdict:
      r.coverage < 0.3
        ? { label: `Couverture faible (${Math.round(r.coverage * 100)} %)`, tone: "warn" }
        : { label: `${r.sample ?? "—"} mesuré${(r.sample ?? 0) > 1 ? "s" : ""} · couverture ${Math.round(r.coverage * 100)} %`, tone: "pos" },
  };
}

export default async function AlignementPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const contacts = await fetchAlignmentContacts(supabase, orgId);
  const [velocity, handoff, salesCycle, dealToInvoice, invoiceToPayment, leakage, mrrAtRisk] = await Promise.all([
    Promise.resolve(computeLifecycleVelocity(contacts)),
    computeMqlHandoff(supabase, orgId, contacts),
    computeRealSalesCycle(supabase, orgId),
    computeReconciledMetric(supabase, orgId, "deal_won_to_first_invoice"),
    computeReconciledMetric(supabase, orgId, "invoice_to_payment"),
    computeReconciledMetric(supabase, orgId, "revenue_leakage"),
    computeReconciledMetric(supabase, orgId, "mrr_at_risk"),
  ]);

  const noLifecycleDates = velocity.datedContacts === 0;

  const tiles: StatTile[] = [
    handoff.medianDaysToDeal != null
      ? {
          label: "MQL → deal créé",
          value: fmtDays(handoff.medianDaysToDeal),
          tone: "accent",
          sub: "Relais marketing → ventes (médiane)",
          verdict: { label: `${handoff.withDealCount}/${handoff.linkableCount} MQL avec deal`, tone: "pos" },
        }
      : { label: "MQL → deal créé", value: "—", tone: "neutral", sub: "Relais marketing → ventes", verdict: { label: "Donnée insuffisante", tone: "warn" } },
    salesCycle.medianDays != null
      ? { label: "Cycle de vente réel", value: fmtDays(salesCycle.medianDays), tone: "accent", sub: "Création → closing (deals gagnés)", verdict: { label: `${salesCycle.sample} deals mesurés`, tone: "pos" } }
      : { label: "Cycle de vente réel", value: "—", tone: "neutral", sub: "Création → closing (deals gagnés)", verdict: { label: "Donnée insuffisante", tone: "warn" } },
    delayTile("Deal gagné → 1re facture", "Relais ventes → finance (médiane)", dealToInvoice),
    delayTile("Facture → encaissement", "DSO opérationnel (médiane)", invoiceToPayment),
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Alignement</h1>
        <p className="mt-1 text-sm text-slate-500">
          L&apos;alignement entre vos services, mesuré sur vos données réelles : temps passé à chaque étape du
          lifecycle, relais marketing → ventes, ventes → finance et finance → service client.
        </p>
      </header>

      <InsightLockedBlock />

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_automatisations" categories={["crm", "billing", "support"]}>

      {/* Prérequis de collecte pas encore rempli → on le dit, on n'affiche pas de faux zéros. */}
      {noLifecycleDates && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-bold">⏳ Les dates d&apos;entrée en lifecycle stage ne sont pas encore collectées</p>
          <p className="mt-1 leading-relaxed">
            Le funnel de vélocité et le relais MQL → ventes s&apos;activeront après la prochaine synchronisation
            HubSpot (les propriétés <code>hs_v2_date_entered_*</code> viennent d&apos;être ajoutées à la collecte).
            Lance une resynchronisation complète depuis Paramètres → Intégrations pour couvrir tout l&apos;historique.
          </p>
        </div>
      )}

      <KpiStatTiles tiles={tiles} />

      {/* ── Bloc 1 : vélocité du lifecycle (marketing → ventes) ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Vélocité du lifecycle
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {velocity.datedContacts} contacts datés / {velocity.totalContacts}
            </span>
          </h2>
        }
      >
        <p className="text-xs text-slate-500">
          Temps médian passé par les contacts à chaque étape (lead → MQL → SQL → opportunité → client) et taux
          de passage. C&apos;est ici qu&apos;on voit l&apos;étape qui gonfle — et donc l&apos;équipe qui a besoin
          d&apos;aide, pas de reproches.
        </p>
        <div className="mt-4">
          <BlockDataTable
            title="Vélocité du lifecycle"
            subtitle="temps médian par étape"
            team="revops"
            unit="count"
            nameLabel="Étape"
            valueLabel="Contacts entrés"
            extraColumns={["Délai médian vers l'étape suivante", "Taux de passage", "Échantillon"]}
            rows={velocity.steps.map((s) => ({
              name: s.label,
              value: s.reached,
              unit: "count" as const,
              cells: [
                s.medianDaysToNext != null ? `${s.medianDaysToNext.toLocaleString("fr-FR")} j` : "—",
                s.conversionPct != null ? `${s.conversionPct} %` : "—",
                s.sample > 0 ? `${s.sample} contacts` : "—",
              ],
            }))}
            footnote="Médiane sur les contacts dont la date d'entrée dans l'étape est connue (hs_v2_date_entered_*). « — » = échantillon vide, jamais un faux zéro."
          />
        </div>
      </CollapsibleBlock>

      {/* ── Bloc 2 : relais marketing → ventes ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Relais marketing → ventes
            {handoff.abandonedCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                {handoff.abandonedCount} MQL abandonnés
              </span>
            )}
          </h2>
        }
      >
        <p className="text-xs text-slate-500">
          Le passage de témoin le plus critique : un MQL qualifié par le marketing doit devenir un deal côté
          ventes. Délai médian, taux de prise en charge, et la liste nominative des MQL qui attendent depuis
          plus de {handoff.abandonAfterDays} jours.
        </p>

        <div className="mt-4">
          <BlockDataTable
            title="Relais marketing → ventes"
            subtitle="prise en charge des MQL"
            team="sales"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            rows={[
              { name: "Contacts entrés en MQL (datés)", value: handoff.mqlCount, unit: "count" },
              { name: "MQL rattachés à une entreprise (joignables)", value: handoff.linkableCount, unit: "count" },
              { name: "MQL avec deal créé ensuite", value: handoff.withDealCount, unit: "count" },
              { name: `MQL abandonnés (≥ ${handoff.abandonAfterDays} j sans deal)`, value: handoff.abandonedCount, unit: "count" },
            ]}
            footnote={`Délai médian MQL → premier deal de l'entreprise : ${fmtDays(handoff.medianDaysToDeal)}. Jointure contact → deals via company_id, sur les vraies dates HubSpot.`}
          />
        </div>

        {handoff.abandoned.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-red-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-red-100 bg-red-50/60 text-[11px] uppercase tracking-wide text-red-700">
                  <th className="px-2.5 py-2 font-semibold">MQL en attente</th>
                  <th className="px-2.5 py-2 font-semibold">Email</th>
                  <th className="px-2.5 py-2 font-semibold">MQL depuis</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Attente</th>
                </tr>
              </thead>
              <tbody>
                {handoff.abandoned.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 transition hover:bg-red-50/40">
                    <td className="px-2.5 py-1.5 font-medium text-slate-900">{c.name}</td>
                    <td className="px-2.5 py-1.5 text-slate-600">{c.email ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-slate-600">{fmtDate(c.mqlDate)}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-red-600">{c.daysSince} j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleBlock>

      {/* ── Bloc 3 : relais ventes → finance ── */}
      <CollapsibleBlock
        title={<h2 className="text-lg font-semibold text-slate-900">Relais ventes → finance</h2>}
      >
        <p className="text-xs text-slate-500">
          Un deal gagné doit devenir une facture, puis un encaissement. Délais médians et fuite de revenu
          (deals gagnés jamais facturés) — jointures réelles CRM × facturation sur company_id.
        </p>
        <div className="mt-4">
          <BlockDataTable
            title="Relais ventes → finance"
            subtitle="du closing à l'encaissement"
            team="finance"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            rows={[
              {
                name: "Délai deal gagné → 1re facture (médiane, jours)",
                value: dealToInvoice?.hasData ? dealToInvoice.value : 0,
                unit: "count" as const,
                cells: [dealToInvoice?.hasData ? `${dealToInvoice.sample} deals · couverture ${Math.round((dealToInvoice.coverage ?? 0) * 100)} %` : "Donnée insuffisante"],
              },
              {
                name: "Délai facture → encaissement (médiane, jours)",
                value: invoiceToPayment?.hasData ? invoiceToPayment.value : 0,
                unit: "count" as const,
                cells: [invoiceToPayment?.hasData ? `${invoiceToPayment.sample} factures · couverture ${Math.round((invoiceToPayment.coverage ?? 0) * 100)} %` : "Donnée insuffisante"],
              },
            ]}
            extraColumns={["Fiabilité"]}
            footnote={
              leakage?.hasData
                ? `Fuite de revenu : ${fmtEur(leakage.value)} de deals gagnés sans aucune facture (couverture ${Math.round((leakage.coverage ?? 0) * 100)} %).`
                : "Fuite de revenu : donnée insuffisante (connectez un outil de facturation et vérifiez le rapprochement)."
            }
          />
        </div>
      </CollapsibleBlock>

      {/* ── Bloc 4 : relais finance → service client ── */}
      <CollapsibleBlock
        title={<h2 className="text-lg font-semibold text-slate-900">Relais finance → service client</h2>}
      >
        <p className="text-xs text-slate-500">
          La boucle se ferme côté rétention : le revenu récurrent exposé quand un compte facturé a un ticket
          ouvert. Jointure abonnements × tickets sur company_id.
        </p>
        <div className="mt-4">
          <BlockDataTable
            title="Relais finance → service client"
            subtitle="revenu récurrent sous tension"
            team="csm"
            unit="currency"
            nameLabel="Indicateur"
            valueLabel="Montant"
            rows={[
              {
                name: "MRR à risque (comptes avec ticket ouvert)",
                value: mrrAtRisk?.hasData ? mrrAtRisk.value : 0,
                unit: "currency" as const,
                cells: [mrrAtRisk?.hasData ? `couverture ${Math.round((mrrAtRisk.coverage ?? 0) * 100)} %` : "Donnée insuffisante"],
              },
            ]}
            extraColumns={["Fiabilité"]}
            footnote="Un MRR à risque élevé et durable = relais CS → finance à organiser (priorisation des tickets des comptes à fort MRR)."
          />
        </div>
      </CollapsibleBlock>

      </PageSourcesGate>

      <PageDataTables pageKey="audit_automatisations" />
    </section>
  );
}
