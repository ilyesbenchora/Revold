/**
 * Blocs « Radar de facturation » + « Du closing à la 1re facture » — rendus
 * sur les sous-pages CRM ↔ outil de facturation (Rapprochement de données),
 * SCOPÉS aux factures de l'outil de la page. C'est un rapprochement de
 * données : deals/contrats CRM × factures de l'outil.
 */

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBillingRadar, computeWonToInvoiceDetail } from "@/lib/audit/billing-radar";
import { TresoLineChart } from "@/components/charts/treso-charts";
import { HBarChart } from "@/components/charts/hbar-chart";
import { CreateInvoiceTaskButton } from "@/components/billing/create-invoice-task-button";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export async function BillingRadarBlocks({
  supabase,
  orgId,
  hubspotToken,
  provider,
  toolLabel,
  crmLabel,
}: {
  supabase: SupabaseClient;
  orgId: string;
  hubspotToken: string | null;
  /** Outil de facturation de la page (ex : "pennylane") — scope des factures. */
  provider: string;
  toolLabel: string;
  crmLabel: string;
}) {
  const [radar, wonToInvoice] = await Promise.all([
    computeBillingRadar(supabase, orgId, 10, [provider]),
    computeWonToInvoiceDetail(supabase, orgId, hubspotToken, 10, [provider]),
  ]);
  if (!radar.hasData && !wonToInvoice.hasData) return null;

  return (
    <>
      {/* ── RADAR DE FACTURATION : factures attendues non émises ── */}
      {radar.hasData && (
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Radar de facturation
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Factures {toolLabel} ATTENDUES mais non émises — détectées par le rythme de facturation réel
                de chaque client ({radar.regularCount}/{radar.analyzed} clients au rythme établi) et par la
                date de fin de contrat mappée depuis {crmLabel}.
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
                    <span aria-hidden>💡</span> À facturer maintenant{it.usualAmount ? ` (~${eur(it.usualAmount)} de trésorerie en attente)` : ""} — vérifie dans {toolLabel} puis relance le owner.
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
            pour affiner le radar. Alerte : tuile « Factures attendues en retard » (page Trésorerie, ＋ Ajouter un bloc).
          </p>
        </div>
      )}

      {/* ── DU CLOSING À LA 1RE FACTURE ── */}
      {wonToInvoice.hasData && (
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Du closing à la 1re facture
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Délai réel entre le passage d&apos;un deal {crmLabel} en « gagné » (date de closing synchronisée
                automatiquement) et sa première facture {toolLabel} — mesuré deal par deal.
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
            Tuiles alertables sur la page Trésorerie (＋ Ajouter un bloc) : « Deal gagné → 1re facture (délai
            médian) » et « Deals gagnés sans facture ».
          </p>
        </div>
      )}
    </>
  );
}
