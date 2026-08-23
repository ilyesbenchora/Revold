"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvoicePaymentState, InvoicePaymentProposal } from "@/lib/reconciliation/payment-invoice-matching";

/**
 * Bloc « Rapprochement facture ↔ paiements » (page Trésorerie) — le dernier
 * maillon du lignage deal → facture → ENCAISSEMENT : les paiements réels
 * (Stripe, GoCardless…) reliés à leurs factures, propositions confirmées en un
 * clic, reste dû réel par facture. Rien n'est écrit sans validation.
 */

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  solde: { label: "Encaissée", cls: "bg-emerald-50 text-emerald-700" },
  partiel: { label: "Partiellement encaissée", cls: "bg-amber-50 text-amber-700" },
  surpaye: { label: "Trop-perçu", cls: "bg-violet-50 text-violet-700" },
  non_encaisse: { label: "Non encaissée", cls: "bg-rose-50 text-rose-700" },
};

const CONFIDENCE_BADGE: Record<InvoicePaymentProposal["confidence"], { label: string; cls: string }> = {
  high: { label: "Montant exact", cls: "bg-emerald-50 text-emerald-700" },
  combo: { label: "Somme des paiements = facture", cls: "bg-amber-50 text-amber-700" },
  manual: { label: "À choisir", cls: "bg-slate-100 text-slate-500" },
};

export function InvoicePaymentLinks() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<InvoicePaymentState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reconciliation/invoice-payments");
      if (!res.ok) return;
      const d = (await res.json()) as InvoicePaymentState;
      setState(d);
      const init: Record<string, Set<string>> = {};
      for (const p of d.proposals) init[p.invoiceId] = new Set(p.candidates.filter((c) => c.preselected).map((c) => c.id));
      setChecked(init);
    } catch {
      /* réseau : le bloc reste sur son dernier état */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggle(invoiceId: string, paymentId: string) {
    setChecked((prev) => {
      const next = new Set(prev[invoiceId] ?? []);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return { ...prev, [invoiceId]: next };
    });
  }

  async function link(p: InvoicePaymentProposal) {
    const ids = [...(checked[p.invoiceId] ?? [])];
    if (ids.length === 0 || busy) return;
    setBusy(p.invoiceId);
    setError(null);
    try {
      const res = await fetch("/api/reconciliation/invoice-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: p.invoiceId, paymentIds: ids }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Rattachement impossible."); return; }
      await load();
    } catch {
      setError("Rattachement impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function unlink(paymentId: string) {
    if (busy) return;
    setBusy(paymentId);
    try {
      const res = await fetch("/api/reconciliation/invoice-payments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      if (res.ok) await load();
    } catch {
      /* best effort */
    } finally {
      setBusy(null);
    }
  }

  if (state && !state.available) return null; // pas de connecteur paiement → bloc absent
  const stats = state?.stats;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3 text-left transition hover:bg-slate-100/60"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Rapprochement facture ↔ paiements
            {stats && stats.invoices > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {stats.linkedInvoices}/{stats.invoices} factures rapprochées
              </span>
            )}
            {stats && stats.dueTotal > 0 && (
              <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                {fmtEur(stats.dueTotal)} de reste dû
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Le dernier maillon : chaque facture reliée à SES paiements réels — reste dû exact, trop-perçus détectés.
            Le moteur propose, tu confirmes.
          </p>
        </div>
        <span className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div className="space-y-4 p-4">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

          {/* ── Propositions à confirmer ── */}
          {(state?.proposals ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Propositions à confirmer ({state!.proposals.length})
              </p>
              <div className="mt-2 space-y-2">
                {state!.proposals.slice(0, 12).map((p) => {
                  const badge = CONFIDENCE_BADGE[p.confidence];
                  const sel = checked[p.invoiceId] ?? new Set();
                  const selSum = p.candidates.filter((c) => sel.has(c.id)).reduce((s, c) => s + c.amount, 0);
                  return (
                    <div key={p.invoiceId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {p.number ?? "Facture"}
                          {p.companyName && <span className="font-normal text-slate-400"> · {p.companyName}</span>}
                          <span className="ml-2 tabular-nums text-slate-600">{fmtEur(p.amountTotal)}</span>
                          <span className="ml-1 text-[10px] text-slate-400">émise le {fmtDate(p.issuedAt)}</span>
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {p.candidates.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={sel.has(c.id)}
                              onChange={() => toggle(p.invoiceId, c.id)}
                              className="h-3.5 w-3.5 accent-fuchsia-600"
                            />
                            <span className="font-medium tabular-nums text-slate-800">{fmtEur(c.amount)}</span>
                            <span className="text-[10px] text-slate-400">encaissé le {fmtDate(c.paidAt)}</span>
                            {c.source && <span className="text-[10px] text-slate-400">· {c.source}</span>}
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[10px] tabular-nums text-slate-400">
                          Sélection : {fmtEur(selSum)} / {fmtEur(p.amountTotal)}
                        </p>
                        <button
                          type="button"
                          disabled={busy != null || sel.size === 0}
                          onClick={() => void link(p)}
                          className="rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === p.invoiceId ? "Rattachement…" : "Lier à la facture"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Factures rapprochées : reste dû réel ── */}
          {(state?.rows ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Factures rapprochées — reste dû réel
              </p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Facture</th>
                      <th className="px-3 py-2 text-right font-semibold">Montant</th>
                      <th className="px-3 py-2 text-right font-semibold">Encaissé</th>
                      <th className="px-3 py-2 text-right font-semibold">Reste dû</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="px-3 py-2 font-semibold">Paiements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state!.rows.slice(0, 30).map((r) => {
                      const badge = STATE_BADGE[r.state];
                      return (
                        <tr key={r.invoiceId} className="border-b border-slate-100 last:border-0">
                          <td className="max-w-52 truncate px-3 py-2 font-medium text-slate-800" title={r.number ?? "Facture"}>
                            {r.number ?? "Facture"}
                            {r.companyName && <span className="block truncate text-[10px] font-normal text-slate-400">{r.companyName}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtEur(r.amountTotal)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtEur(r.paid)}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${r.due === 0 ? "text-slate-500" : r.due > 0 ? "text-rose-600" : "text-violet-600"}`}>
                            {r.due === 0 ? "—" : fmtEur(r.due)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex flex-wrap gap-1">
                              {r.payments.map((pmt) => (
                                <button
                                  key={pmt.id}
                                  type="button"
                                  disabled={busy != null}
                                  title={`${fmtEur(pmt.amount)} — cliquer pour détacher`}
                                  onClick={() => void unlink(pmt.id)}
                                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
                                >
                                  {fmtEur(pmt.amount)} ✕
                                </button>
                              ))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {stats && stats.unmatchedPaymentsTotal > 0 && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-violet-600">{fmtEur(stats.unmatchedPaymentsTotal)}</span> de paiements
                  jamais rattachés à une facture — trop-perçu ou facture manquante à vérifier.
                </p>
              )}
            </div>
          )}

          {state && state.proposals.length === 0 && state.rows.length === 0 && (
            <p className="text-xs text-slate-500">
              Aucune facture à rapprocher à un paiement pour l&apos;instant — les propositions apparaîtront dès qu&apos;un
              paiement (Stripe, GoCardless…) sera rattaché à la même entreprise qu&apos;une facture ouverte.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
