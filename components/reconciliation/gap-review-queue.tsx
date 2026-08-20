"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompanyGapRow, GapReviewStatus, PeriodGapRow } from "@/lib/reconciliation/gap-reviews";

/**
 * File d'APUREMENT des écarts CA signé ↔ facturé (page Trésorerie) — le
 * dossier de réconciliation : chaque entreprise en écart porte un statut
 * (à traiter / justifié / à corriger / corrigé) et une note, exportables en
 * CSV pour l'expert-comptable. Les avoirs sont affichés séparément : un écart
 * couvert par un avoir se justifie en connaissance de cause.
 */

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const STATUS_META: Record<GapReviewStatus, { label: string; cls: string }> = {
  open: { label: "À traiter", cls: "bg-rose-50 text-rose-700" },
  justified: { label: "Justifié", cls: "bg-emerald-50 text-emerald-700" },
  to_fix: { label: "À corriger", cls: "bg-amber-50 text-amber-700" },
  fixed: { label: "Corrigé", cls: "bg-slate-100 text-slate-600" },
};
const STATUS_ORDER: GapReviewStatus[] = ["open", "to_fix", "justified", "fixed"];

/** Échappe une cellule CSV (guillemets doublés, cellule toujours quotée). */
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function GapReviewQueue() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CompanyGapRow[] | null>(null);
  const [periods, setPeriods] = useState<PeriodGapRow[]>([]);
  const [reviewsAvailable, setReviewsAvailable] = useState(true);
  const [filter, setFilter] = useState<GapReviewStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Note en cours d'édition (companyId → texte).
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reconciliation/gap-reviews");
      if (!res.ok) return;
      const d = (await res.json()) as { rows: CompanyGapRow[]; reviewsAvailable: boolean; periods?: PeriodGapRow[] };
      setRows(d.rows);
      setPeriods(Array.isArray(d.periods) ? d.periods : []);
      setReviewsAvailable(d.reviewsAvailable);
      setNoteDraft(Object.fromEntries(d.rows.map((r) => [r.companyId, r.note ?? ""])));
    } catch { /* réseau */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(r: CompanyGapRow, status: GapReviewStatus) {
    if (busy) return;
    setBusy(r.companyId);
    setError(null);
    try {
      const res = await fetch("/api/reconciliation/gap-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: r.companyId, status, note: noteDraft[r.companyId] ?? r.note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setRows((prev) =>
        (prev ?? []).map((x) => (x.companyId === r.companyId ? { ...x, status, note: noteDraft[r.companyId] ?? x.note } : x)),
      );
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  /** Export CSV du dossier complet (toutes lignes, tous statuts). */
  function exportCsv() {
    const all = rows ?? [];
    const header = ["Entreprise", "CA signé", "Facturé", "dont avoirs", "Écart", "Deals", "Factures", "Statut", "Note"];
    const lines = all.map((r) =>
      [
        csvCell(r.companyName),
        r.wonTotal,
        r.billedTotal,
        r.creditTotal,
        r.gap,
        r.dealCount,
        r.invoiceCount,
        csvCell(STATUS_META[r.status].label),
        csvCell(r.note ?? ""),
      ].join(";"),
    );
    // BOM UTF-8 : accents corrects à l'ouverture dans Excel.
    const blob = new Blob(["﻿" + [header.map(csvCell).join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revold-apurement-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (rows ?? []).length };
    for (const s of STATUS_ORDER) c[s] = (rows ?? []).filter((r) => r.status === s).length;
    return c;
  }, [rows]);
  const visible = (rows ?? []).filter((r) => filter === "all" || r.status === filter);
  const openGapTotal = (rows ?? []).filter((r) => r.status === "open" || r.status === "to_fix").reduce((s, r) => s + r.gap, 0);

  // Aucun écart ET aucune activité périodisée → pas de bloc.
  const hasPeriods = periods.some((p) => p.won !== 0 || p.billed !== 0);
  if (rows !== null && rows.length === 0 && !hasPeriods) return null;

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
            File d&apos;apurement des écarts
            {counts.open > 0 && (
              <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                {counts.open} à traiter
              </span>
            )}
            {openGapTotal !== 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                {fmtEur(openGapTotal)} non statué
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Chaque écart CA signé ↔ facturé statué entreprise par entreprise (justifié, à corriger, corrigé) —
            exportable en CSV pour l&apos;expert-comptable.
          </p>
        </div>
        <span className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="space-y-3 p-4">
          {!reviewsAvailable && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Migration 20260820000002_recon_gap_reviews non appliquée — les statuts s&apos;activeront au prochain déploiement.
            </p>
          )}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

          {/* ── PÉRIODISATION : signé (close date) vs facturé (émission) par
                 trimestre — « les deals gagnés en T1 ont-ils été facturés ? » ── */}
          {periods.length > 0 && periods.some((p) => p.won !== 0 || p.billed !== 0) && (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-1.5 font-semibold">Trimestre</th>
                    {periods.map((p) => (
                      <th key={p.period} className="px-3 py-1.5 text-right font-semibold tabular-nums">{p.period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-500">CA signé</td>
                    {periods.map((p) => (
                      <td key={p.period} className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmtEur(p.won)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-500">Facturé</td>
                    {periods.map((p) => (
                      <td key={p.period} className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                        {fmtEur(p.billed)}
                        {p.credits > 0 && (
                          <span className="block text-[10px] text-violet-600">avoirs −{fmtEur(p.credits)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-medium text-slate-600">Écart</td>
                    {periods.map((p) => (
                      <td
                        key={p.period}
                        className={`px-3 py-1.5 text-right font-semibold tabular-nums ${
                          p.gap === 0 ? "text-slate-400" : p.gap > 0 ? "text-rose-600" : "text-violet-600"
                        }`}
                      >
                        {p.gap === 0 ? "—" : fmtEur(p.gap)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", ...STATUS_ORDER] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s as GapReviewStatus | "all")}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  filter === s
                    ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {s === "all" ? "Tous" : STATUS_META[s as GapReviewStatus].label} · {counts[s] ?? 0}
              </button>
            ))}
            <button
              type="button"
              onClick={exportCsv}
              className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              ⬇ Exporter le dossier (CSV)
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Entreprise</th>
                  <th className="px-3 py-2 text-right font-semibold">CA signé</th>
                  <th className="px-3 py-2 text-right font-semibold">Facturé</th>
                  <th className="px-3 py-2 text-right font-semibold">Écart</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 40).map((r) => (
                  <tr key={r.companyId} className="border-b border-slate-100 align-top last:border-0">
                    <td className="max-w-48 truncate px-3 py-2 font-medium text-slate-800" title={r.companyName}>
                      {r.companyName}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {r.dealCount} deal{r.dealCount > 1 ? "s" : ""} · {r.invoiceCount} facture{r.invoiceCount > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtEur(r.wonTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {fmtEur(r.billedTotal)}
                      {r.creditTotal > 0 && (
                        <span className="block text-[10px] text-violet-600">dont avoirs −{fmtEur(r.creditTotal)}</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${r.gap > 0 ? "text-rose-600" : "text-violet-600"}`}>
                      {fmtEur(r.gap)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.status}
                        disabled={busy != null || !reviewsAvailable}
                        onChange={(e) => void setStatus(r, e.target.value as GapReviewStatus)}
                        className={`rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium outline-none focus:border-accent ${STATUS_META[r.status].cls}`}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={noteDraft[r.companyId] ?? ""}
                        disabled={!reviewsAvailable}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, [r.companyId]: e.target.value }))}
                        onBlur={() => {
                          if ((noteDraft[r.companyId] ?? "") !== (r.note ?? "")) void setStatus(r, r.status);
                        }}
                        placeholder="Ex : échéancier en 3 fois, avoir n°…"
                        className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-accent"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 40 && (
            <p className="text-[11px] text-slate-400">40 premières lignes affichées — l&apos;export CSV contient tout.</p>
          )}
        </div>
      )}
    </div>
  );
}
