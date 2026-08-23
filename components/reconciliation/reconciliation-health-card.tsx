import type { SupabaseClient } from "@supabase/supabase-js";
import { computeDealInvoiceState } from "@/lib/reconciliation/deal-invoice-matching";
import { computeInvoicePaymentState } from "@/lib/reconciliation/payment-invoice-matching";

/**
 * Carte « Santé de réconciliation » (haut de la section Trésorerie) — rend
 * VISIBLE le lignage deal → facture → encaissement d'un coup d'œil :
 *  - un score 0..100 + sa tendance (table reconciliation_health, historisée) ;
 *  - le funnel : deals gagnés → soldés / écart / fuite ; factures → encaissées
 *    / reste dû ; paiements non rattachés ;
 *  - la RÉVÉLATION DE LA COMPENSATION : écart NET (se compense entre deals)
 *    vs écart BRUT (Σ |écart par deal|) — deal A +10 k, deal B −10 k = 0 net
 *    mais 20 k réels à traiter. Le détail deal par deal est dans les blocs
 *    « Rapprochement deal ↔ factures » et « facture ↔ paiements » en dessous.
 */

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export async function ReconciliationHealthCard({ supabase, orgId }: { supabase: SupabaseClient; orgId: string }) {
  const [deal, pay] = await Promise.all([
    computeDealInvoiceState(supabase, orgId),
    computeInvoicePaymentState(supabase, orgId),
  ]);

  // Deal→facture indisponible (migration deal_id absente) ET aucune facture :
  // rien à montrer.
  if (!deal.available && !pay.available) return null;
  if (deal.stats.wonDeals === 0 && pay.stats.invoices === 0) return null;

  // Écart BRUT = Σ |écart par deal| sur les deals non soldés (révèle la
  // compensation qu'un total net masque).
  const dealGapGross = deal.rows.reduce((s, r) => s + (r.state === "solde" ? 0 : Math.abs(r.gap)), 0);
  const dealGapNet = deal.stats.gapTotal;
  const compensation = Math.abs(dealGapGross) - Math.abs(dealGapNet);

  const dealRatio = deal.stats.wonDeals > 0 ? deal.stats.solde / deal.stats.wonDeals : 1;
  const invRatio = pay.stats.invoices > 0 ? pay.stats.solde / pay.stats.invoices : 1;

  // Score + tendance : depuis reconciliation_health si dispo (cron), sinon
  // calcul live sans le volet multi-source (approché).
  let score = Math.round(100 * (0.55 * dealRatio + 0.45 * invRatio));
  let prevScore: number | null = null;
  try {
    const { data } = await supabase
      .from("reconciliation_health")
      .select("score, day")
      .eq("organization_id", orgId)
      .order("day", { ascending: false })
      .limit(2);
    const rows = (data ?? []) as Array<{ score: number; day: string }>;
    if (rows[0]) score = rows[0].score;
    if (rows[1]) prevScore = rows[1].score;
  } catch {
    /* table absente → score live */
  }

  const trend = prevScore != null ? score - prevScore : null;
  const scoreTone = score >= 80 ? "text-emerald-600" : score >= 55 ? "text-amber-600" : "text-rose-600";
  const scoreRing = score >= 80 ? "border-emerald-200 bg-emerald-50" : score >= 55 ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50";

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-card-border bg-slate-50/60 px-4 py-3">
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border ${scoreRing}`}>
          <span className={`text-lg font-bold tabular-nums leading-none ${scoreTone}`}>{score}</span>
          <span className="text-[8px] font-medium uppercase text-slate-400">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Santé de réconciliation
            {trend != null && trend !== 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${trend > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {trend > 0 ? "▲" : "▼"} {Math.abs(trend)} pts
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Le lignage deal → facture → encaissement, réconcilié sur tes vraies données. Détail confirmable dans les blocs ci-dessous.
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Deals soldés" value={`${deal.stats.solde}/${deal.stats.wonDeals}`} tone="text-emerald-700" />
          <Stat label="Factures encaissées" value={`${pay.stats.solde}/${pay.stats.invoices}`} tone="text-emerald-700" />
          <Stat label="Reste dû réel" value={pay.stats.dueTotal > 0 ? fmtEur(pay.stats.dueTotal) : "—"} tone={pay.stats.dueTotal > 0 ? "text-rose-600" : undefined} />
          <Stat label="Deals sans facture" value={deal.stats.leakTotal > 0 ? fmtEur(deal.stats.leakTotal) : "—"} tone={deal.stats.leakTotal > 0 ? "text-rose-600" : undefined} />
        </div>

        {/* ── Révélation de la compensation : net vs brut ── */}
        {dealGapGross > 0 && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-violet-800">
              Écart signé ↔ facturé : {fmtEur(dealGapNet)} net · <span className="text-violet-900">{fmtEur(dealGapGross)} brut</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              {compensation > Math.max(1, Math.abs(dealGapNet) * 0.05) ? (
                <>
                  Le total net <strong>masque {fmtEur(compensation)} de compensations</strong> entre deals (surfacturés d&apos;un
                  côté, sous-facturés de l&apos;autre) : <strong>{fmtEur(dealGapGross)}</strong> sont réellement à traiter, deal
                  par deal — pas {fmtEur(Math.abs(dealGapNet))}. Le détail est dans « Rapprochement deal ↔ factures ».
                </>
              ) : (
                <>Écart réparti sur les deals non soldés — détail deal par deal dans « Rapprochement deal ↔ factures ».</>
              )}
            </p>
          </div>
        )}

        {pay.stats.unmatchedPaymentsTotal > 0 && (
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-violet-600">{fmtEur(pay.stats.unmatchedPaymentsTotal)}</span> de paiements
            encaissés jamais rattachés à une facture — trop-perçu ou facture manquante (voir « Rapprochement facture ↔ paiements »).
          </p>
        )}
      </div>
    </div>
  );
}
