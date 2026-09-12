export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CashRecoveryBlock } from "@/components/roi/cash-recovery-block";
import { ReconciliationHealthCard } from "@/components/reconciliation/reconciliation-health-card";
import { DealInvoiceLinks } from "@/components/reconciliation/deal-invoice-links";
import { GapReviewQueue } from "@/components/reconciliation/gap-review-queue";

/**
 * Finance → Récupération de cash : le cash DÉJÀ récupéré (relances encaissées)
 * ET le cash À récupérer (écarts signé ↔ facturé ↔ encaissé). Ces blocs
 * vivaient sur la Trésorerie, mélangés aux rapports — ici ils ont leur place
 * dédiée. Vue d'ensemble « à récupérer » en tête, détail des écarts en dessous.
 */

const eur = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default async function RecuperationCashPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  const supabase = await createSupabaseServerClient();

  // Vue d'ensemble « cash à récupérer » : dernier snapshot reconciliation_health.
  type Health = { deal_gap_gross: number | null; deal_leak_total: number | null; due_total: number | null };
  let health: Health | null = null;
  try {
    const { data } = await supabase
      .from("reconciliation_health")
      .select("deal_gap_gross, deal_leak_total, due_total")
      .eq("organization_id", orgId)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    health = (data as unknown as Health | null) ?? null;
  } catch { /* table absente → vue d'ensemble masquée */ }

  const toRecover = [
    { label: "Écart signé ↔ facturé", value: health?.deal_gap_gross ?? null, sub: "à arbitrer ou corriger (brut, par deal)" },
    { label: "Vendu non facturé", value: health?.deal_leak_total ?? null, sub: "deals gagnés sans facture émise" },
    { label: "Reste dû réel", value: health?.due_total ?? null, sub: "factures émises non encaissées" },
  ];
  const hasOverview = health && toRecover.some((t) => (t.value ?? 0) > 0);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Récupération de cash</h1>
        <p className="mt-1 text-sm text-slate-500">
          Le cash déjà récupéré par tes relances, et le cash qu&apos;il reste à récupérer (écarts entre ce que tu as
          signé, facturé et encaissé). La preuve en euros, ligne par ligne.
        </p>
      </header>

      {/* Vue d'ensemble : le cash À RÉCUPÉRER (complément du récupéré ci-dessous). */}
      {hasOverview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {toRecover.map((t) => (
            <article key={t.label} className="card p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${(t.value ?? 0) > 0 ? "text-rose-600" : "text-slate-400"}`}>{eur(t.value)}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{t.sub}</p>
            </article>
          ))}
        </div>
      )}

      {/* Cash DÉJÀ récupéré (relances encaissées) — vue d'ensemble ligne à ligne. */}
      <CashRecoveryBlock view="recovery" />

      {/* Monitoring des ÉCARTS (signé ↔ facturé ↔ encaissé) — déplacé depuis la
          Trésorerie : score de réconciliation, écart deal par deal, file d'apurement. */}
      <ReconciliationHealthCard supabase={supabase} orgId={orgId} />
      <DealInvoiceLinks />
      <GapReviewQueue />
    </section>
  );
}
