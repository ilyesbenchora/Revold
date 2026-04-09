import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PerformancesTabs } from "@/components/performances-tabs";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const fmtK = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K €` : `${fmt(n)} €`;

export default async function PaiementFacturationPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // All queries wrapped in try/catch so the page renders even if the canonical
  // tables haven't been migrated yet. Missing tables = null data = "—" in UI.
  let activeSubs: Array<{ mrr: number }> = [];
  let canceledSubsCount = 0;
  let totalSubsCount = 0;
  let payments: Array<{ status: string; amount: number }> = [];
  let invoices: Array<{ status: string; amount_total: number; amount_due: number; contact_id: string | null }> = [];

  try {
    const [
      { data: subs },
      { count: canceledCount },
      { count: totalCount },
      { data: payData },
      { data: invData },
    ] = await Promise.all([
      supabase.from("subscriptions").select("mrr").eq("organization_id", orgId).in("status", ["active", "trialing"]),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "canceled"),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("payments").select("status, amount").eq("organization_id", orgId),
      supabase.from("invoices").select("status, amount_total, amount_due, contact_id").eq("organization_id", orgId),
    ]);
    activeSubs = (subs ?? []).map((s) => ({ mrr: Number(s.mrr) || 0 }));
    canceledSubsCount = canceledCount ?? 0;
    totalSubsCount = totalCount ?? 0;
    payments = (payData ?? []).map((p) => ({ status: p.status, amount: Number(p.amount) || 0 }));
    invoices = (invData ?? []).map((i) => ({
      status: i.status,
      amount_total: Number(i.amount_total) || 0,
      amount_due: Number(i.amount_due) || 0,
      contact_id: i.contact_id as string | null,
    }));
  } catch {}

  const hasData = activeSubs.length > 0 || payments.length > 0 || invoices.length > 0;

  // ── MRR / ARR ──
  const mrr = activeSubs.reduce((s, sub) => s + sub.mrr, 0);
  const arr = mrr * 12;

  // ── Churn rate ──
  const churnRate = totalSubsCount > 0
    ? Math.round((canceledSubsCount / totalSubsCount) * 100)
    : null;

  // ── LTV (total paid / distinct payers) ──
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalPaid = paidInvoices.reduce((s, i) => s + i.amount_total, 0);
  const distinctPayers = new Set(paidInvoices.map((i) => i.contact_id).filter(Boolean)).size;
  const ltv = distinctPayers > 0 ? Math.round(totalPaid / distinctPayers) : null;

  // ── Payment success rate ──
  const totalPayments = payments.length;
  const succeededPayments = payments.filter((p) => p.status === "succeeded").length;
  const failedPayments = payments.filter((p) => p.status === "failed").length;
  const paymentSuccessRate = totalPayments > 0
    ? Math.round((succeededPayments / totalPayments) * 100)
    : null;

  // ── Avg invoice amount ──
  const avgInvoice = invoices.length > 0
    ? Math.round(invoices.reduce((s, i) => s + i.amount_total, 0) / invoices.length)
    : null;

  // ── Outstanding invoices ──
  const outstanding = invoices.filter((i) => (i.status === "open" || i.status === "uncollectible") && i.amount_due > 0);
  const outstandingCount = outstanding.length;
  const outstandingAmount = outstanding.reduce((s, i) => s + i.amount_due, 0);

  // ── Score ──
  const score = hasData
    ? Math.round(
        (paymentSuccessRate ?? 80) * 0.3 +
        Math.max(0, 100 - (churnRate ?? 10) * 5) * 0.3 +
        (mrr > 0 ? 80 : 0) * 0.2 +
        (outstandingCount === 0 ? 100 : outstandingCount < 5 ? 60 : 20) * 0.2,
      )
    : 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Suivi des paiements, factures et revenus récurrents (Stripe, Pennylane, Sellsy…).
        </p>
      </header>

      <PerformancesTabs />

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Paiement" score={score} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{score}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(score).className}`}>
              {getScoreLabel(score).label}
            </span>
          </div>
        </div>
      </div>

      {/* Revenus récurrents */}
      <CollapsibleBlock title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Revenus Récurrents
        </h2>
      }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MRR</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{hasData ? fmtK(mrr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Mensuel</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">ARR</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{hasData ? fmtK(arr) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Annualisé</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de churn</p>
            <p className={`mt-1 text-3xl font-bold ${churnRate != null && churnRate > 10 ? "text-red-500" : churnRate != null && churnRate > 5 ? "text-orange-500" : "text-emerald-600"}`}>
              {churnRate != null ? `${churnRate}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Abonnements annulés / total</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">LTV moyenne</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">{ltv != null ? fmtK(ltv) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Montant payé / client</p>
          </article>
        </div>
      </CollapsibleBlock>

      {/* Facturation */}
      <CollapsibleBlock title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Facturation
        </h2>
      }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Factures émises</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{hasData ? fmt(invoices.length) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Montant moyen</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{avgInvoice != null ? fmtK(avgInvoice) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Impayées</p>
            <p className={`mt-1 text-3xl font-bold ${outstandingCount > 5 ? "text-red-500" : outstandingCount > 0 ? "text-orange-500" : "text-emerald-600"}`}>
              {hasData ? fmt(outstandingCount) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{outstandingAmount > 0 ? fmtK(outstandingAmount) : ""}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Total encaissé</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{hasData ? fmtK(totalPaid) : "—"}</p>
          </article>
        </div>
      </CollapsibleBlock>

      {/* Paiements */}
      <CollapsibleBlock title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Paiements
        </h2>
      }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Paiements traités</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{hasData ? fmt(totalPayments) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de succès</p>
            <p className={`mt-1 text-3xl font-bold ${paymentSuccessRate != null && paymentSuccessRate >= 95 ? "text-emerald-600" : paymentSuccessRate != null && paymentSuccessRate >= 80 ? "text-orange-500" : "text-red-500"}`}>
              {paymentSuccessRate != null ? `${paymentSuccessRate}%` : "—"}
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Paiements réussis</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{hasData ? fmt(succeededPayments) : "—"}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Paiements échoués</p>
            <p className={`mt-1 text-3xl font-bold ${failedPayments > 0 ? "text-red-500" : "text-emerald-600"}`}>
              {hasData ? fmt(failedPayments) : "—"}
            </p>
          </article>
        </div>
      </CollapsibleBlock>

      {!hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune donnée de paiement/facturation pour l&apos;instant. Connectez Stripe, Pennylane ou Sellsy
            pour alimenter cette page automatiquement.
          </p>
        </div>
      )}
    </section>
  );
}
