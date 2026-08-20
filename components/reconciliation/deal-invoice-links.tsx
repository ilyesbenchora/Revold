"use client";

import { useCallback, useEffect, useState } from "react";
import type { DealInvoiceState, DealInvoiceProposal } from "@/lib/reconciliation/deal-invoice-matching";

/**
 * Bloc « Rapprochement deal ↔ factures » (page Trésorerie) — la réconciliation
 * au niveau du DEAL : propositions du moteur (montant/date/société) confirmées
 * en un clic, puis table des deals liés avec leur écart signé − facturé.
 * Rien n'est écrit sans validation ; une facture liée reste déliable.
 */

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  solde: { label: "Soldé", cls: "bg-emerald-50 text-emerald-700" },
  partiel: { label: "Partiellement facturé", cls: "bg-amber-50 text-amber-700" },
  surfacture: { label: "Sur-facturé", cls: "bg-violet-50 text-violet-700" },
  non_facture: { label: "Non facturé", cls: "bg-rose-50 text-rose-700" },
};

const CONFIDENCE_BADGE: Record<DealInvoiceProposal["confidence"], { label: string; cls: string }> = {
  high: { label: "Correspondance exacte", cls: "bg-emerald-50 text-emerald-700" },
  combo: { label: "Somme des factures = deal", cls: "bg-amber-50 text-amber-700" },
  manual: { label: "À choisir", cls: "bg-slate-100 text-slate-500" },
};

export function DealInvoiceLinks() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DealInvoiceState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cases cochées par proposition (préremplies par le moteur).
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reconciliation/deal-invoices");
      if (!res.ok) return;
      const d = (await res.json()) as DealInvoiceState;
      setState(d);
      const init: Record<string, Set<string>> = {};
      for (const p of d.proposals) init[p.dealId] = new Set(p.candidates.filter((c) => c.preselected).map((c) => c.id));
      setChecked(init);
    } catch {
      /* réseau : le bloc reste sur son dernier état */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggle(dealId: string, invoiceId: string) {
    setChecked((prev) => {
      const next = new Set(prev[dealId] ?? []);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return { ...prev, [dealId]: next };
    });
  }

  async function link(p: DealInvoiceProposal) {
    const ids = [...(checked[p.dealId] ?? [])];
    if (ids.length === 0 || busy) return;
    setBusy(p.dealId);
    setError(null);
    try {
      const res = await fetch("/api/reconciliation/deal-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: p.dealId,
          invoiceIds: ids,
          method: p.confidence === "high" ? "auto_exact" : "manual",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Rattachement impossible.");
        return;
      }
      await load();
    } catch {
      setError("Rattachement impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function unlink(invoiceId: string) {
    if (busy) return;
    setBusy(invoiceId);
    setError(null);
    try {
      const res = await fetch("/api/reconciliation/deal-invoices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      if (res.ok) await load();
    } catch {
      /* best effort */
    } finally {
      setBusy(null);
    }
  }

  if (state && !state.available) return null; // migration non appliquée → bloc absent
  const stats = state?.stats;
  const gaps = (state?.rows ?? []).filter((r) => r.state !== "solde");

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
            Rapprochement deal ↔ factures
            {stats && stats.wonDeals > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {stats.linkedDeals}/{stats.wonDeals} deals rattachés
              </span>
            )}
            {stats && stats.gapTotal !== 0 && (
              <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                {fmtEur(stats.gapTotal)} d&apos;écart
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            La réconciliation au niveau du deal : chaque deal gagné relié à SES factures — écart signé − facturé,
            deal par deal. Le moteur propose, tu confirmes.
          </p>
        </div>
        <span className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
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
                  const sel = checked[p.dealId] ?? new Set();
                  const selSum = p.candidates.filter((c) => sel.has(c.id)).reduce((s, c) => s + c.amountTotal, 0);
                  return (
                    <div key={p.dealId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {p.dealName}
                          {p.companyName && <span className="font-normal text-slate-400"> · {p.companyName}</span>}
                          <span className="ml-2 tabular-nums text-slate-600">{fmtEur(p.amount)}</span>
                          <span className="ml-1 text-[10px] text-slate-400">gagné le {fmtDate(p.closeDate)}</span>
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {p.candidates.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={sel.has(c.id)}
                              onChange={() => toggle(p.dealId, c.id)}
                              className="h-3.5 w-3.5 accent-fuchsia-600"
                            />
                            <span className="tabular-nums">{c.number ?? "Facture"}</span>
                            <span className="font-medium tabular-nums text-slate-800">{fmtEur(c.amountTotal)}</span>
                            <span className="text-[10px] text-slate-400">émise le {fmtDate(c.issuedAt)}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[10px] tabular-nums text-slate-400">
                          Sélection : {fmtEur(selSum)} / {fmtEur(p.amount)}
                        </p>
                        <button
                          type="button"
                          disabled={busy != null || sel.size === 0}
                          onClick={() => void link(p)}
                          className="rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === p.dealId ? "Rattachement…" : "Lier au deal"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Deals rattachés : l'écart deal par deal ── */}
          {(state?.rows ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Deals rattachés — écart signé − facturé
              </p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Deal</th>
                      <th className="px-3 py-2 text-right font-semibold">Signé</th>
                      <th className="px-3 py-2 text-right font-semibold">Facturé (lié)</th>
                      <th className="px-3 py-2 text-right font-semibold">Écart</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="px-3 py-2 font-semibold">Factures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state!.rows.slice(0, 30).map((r) => {
                      const badge = STATE_BADGE[r.state];
                      return (
                        <tr key={r.dealId} className="border-b border-slate-100 last:border-0">
                          <td className="max-w-52 truncate px-3 py-2 font-medium text-slate-800" title={r.dealName}>
                            {r.dealName}
                            {r.companyName && <span className="block truncate text-[10px] font-normal text-slate-400">{r.companyName}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtEur(r.amount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtEur(r.billed)}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${r.gap === 0 ? "text-slate-500" : r.gap > 0 ? "text-rose-600" : "text-violet-600"}`}>
                            {r.gap === 0 ? "—" : fmtEur(r.gap)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex flex-wrap gap-1">
                              {r.invoices.map((i) => (
                                <button
                                  key={i.id}
                                  type="button"
                                  disabled={busy != null}
                                  title={`${fmtEur(i.amountTotal)} — cliquer pour délier`}
                                  onClick={() => void unlink(i.id)}
                                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
                                >
                                  {i.number ?? "Facture"} ✕
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
              {gaps.length > 0 && stats && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-rose-600">{fmtEur(stats.gapTotal)}</span> d&apos;écart cumulé sur{" "}
                  {gaps.length} deal{gaps.length > 1 ? "s" : ""} non soldé{gaps.length > 1 ? "s" : ""}
                  {stats.leakTotal > 0 && (
                    <> · <span className="font-semibold text-slate-700">{fmtEur(stats.leakTotal)}</span> de deals gagnés sans aucune facture candidate</>
                  )}
                  .
                </p>
              )}
            </div>
          )}

          {state && state.proposals.length === 0 && state.rows.length === 0 && (
            <p className="text-xs text-slate-500">
              Aucun deal gagné à rapprocher pour l&apos;instant — les propositions apparaîtront dès qu&apos;un deal
              gagné aura des factures candidates (même entreprise, fenêtre de facturation).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
