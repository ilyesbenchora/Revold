"use client";

import { useEffect, useState } from "react";

/**
 * Bloc ROI « Relances & cash récupéré » (page Trésorerie).
 *
 * La boucle qui prouve la valeur de Revold en euros :
 *  1. les factures en retard sont listées (reste dû, échéance, client) ;
 *  2. « Marquer relancée » fige le reste dû au moment de la relance ;
 *  3. dès que la facture est constatée payée, le montant est attribué en
 *     CASH RÉCUPÉRÉ — total affiché en tête, prouvable ligne à ligne.
 */

type OverdueInvoice = {
  id: string;
  number: string | null;
  company: string | null;
  amountDue: number;
  dueAt: string | null;
  source: string | null;
  remindedAt: string | null;
};

type Stats = { recovered: number; recoveredCount: number; remindedPending: number };

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function daysLate(dueAt: string | null): number {
  if (!dueAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(`${dueAt}T00:00:00`).getTime()) / 86_400_000));
}

export function CashRecoveryBlock() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [overdue, setOverdue] = useState<OverdueInvoice[] | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/roi/reminders");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setNeedsMigration(Boolean(d.needsMigration));
      setStats(d.stats ?? { recovered: 0, recoveredCount: 0, remindedPending: 0 });
      setOverdue(Array.isArray(d.overdue) ? d.overdue : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setOverdue([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remind(invoiceId: string) {
    if (busyId) return;
    setBusyId(invoiceId);
    setError(null);
    try {
      const res = await fetch("/api/roi/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Relance impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Relances & cash récupéré</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Relance tes impayés depuis Revold : chaque facture relancée puis encaissée alimente le compteur —
            l&apos;impact de Revold en euros, prouvable ligne à ligne.
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Cash récupéré</p>
              <p className={`text-xl font-bold tabular-nums ${stats.recovered > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                {eur(stats.recovered)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Factures récupérées</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{stats.recoveredCount}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Relances en cours</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{stats.remindedPending}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {needsMigration && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            La table des relances n&apos;existe pas encore — applique la migration <code>invoice_reminders</code> pour
            activer le suivi du cash récupéré.
          </p>
        )}
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

        {overdue === null ? (
          <p className="text-xs text-slate-400">Chargement des impayés…</p>
        ) : overdue.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune facture en retard — rien à relancer.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2.5 py-2 font-semibold">Facture</th>
                  <th className="px-2.5 py-2 font-semibold">Client</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Reste dû</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Retard</th>
                  <th className="px-2.5 py-2 font-semibold">Relance</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                    <td className="px-2.5 py-2 font-medium text-slate-800">
                      {inv.number ?? "—"}
                      {inv.source && <span className="ml-1.5 text-[10px] text-slate-400">({inv.source})</span>}
                    </td>
                    <td className="px-2.5 py-2 text-slate-700">{inv.company ?? "—"}</td>
                    <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-rose-600">{eur(inv.amountDue)}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-slate-700">{daysLate(inv.dueAt)} j</td>
                    <td className="px-2.5 py-2">
                      {inv.remindedAt ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Relancée le {new Date(inv.remindedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </span>
                      ) : (
                        <button
                          onClick={() => remind(inv.id)}
                          disabled={busyId === inv.id || needsMigration}
                          className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                        >
                          {busyId === inv.id ? "…" : "Marquer relancée"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
