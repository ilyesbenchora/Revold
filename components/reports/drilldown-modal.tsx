"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatBucketLabel, useLocale } from "@/lib/locale";
import { entityLabel } from "@/lib/reports/data-table-presets";
import type { ChartQuery } from "@/lib/ai/agents/agent-runtime";

export type DrilldownTarget = {
  query: ChartQuery & { granularity?: string | null };
  sources: string[];
  period: { from?: string; to?: string; all?: boolean } | null;
  /** Bucket cliqué : clé brute moteur + libellé affiché. null = total (tous). */
  bucket: { raw: string; label: string } | null;
  /** Titre du rapport d'origine (contexte du modal). */
  title?: string;
};

type DetailColumn = { id: string; label: string; kind?: "text" | "currency" | "date" | "count" };

/**
 * DÉTAIL D'UN CHIFFRE (drill-down) : au clic sur une barre, un segment de
 * donut, un point de courbe, une ligne de table ou un total, ce modal liste
 * les enregistrements sous-jacents (contacts, deals, factures, abonnements,
 * transactions…) — mêmes filtres déterministes que le rapport.
 */
export function DrilldownModal({ target, onClose }: { target: DrilldownTarget | null; onClose: () => void }) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<DetailColumn[]>([]);
  const [records, setRecords] = useState<unknown[][]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!target) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setRecords([]);
    fetch("/api/reports/drilldown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: target.query,
        bucket: target.bucket?.raw ?? null,
        sources: target.sources,
        all: target.period?.all ?? !target.period,
        date_from: target.period?.from,
        date_to: target.period?.to,
      }),
    })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(d.error ?? "Détail indisponible.");
          return;
        }
        setColumns(Array.isArray(d.columns) ? d.columns : []);
        setRecords(Array.isArray(d.records) ? d.records : []);
        setTotal(Number(d.totalRecords) || 0);
        setTruncated(Boolean(d.truncated));
      })
      .catch(() => alive && setError("Détail indisponible."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [target]);

  // Bloque le scroll de fond quand le modal est ouvert.
  useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [target]);

  if (!target || typeof document === "undefined") return null;

  function fmtCell(v: unknown, kind?: DetailColumn["kind"]): string {
    if (v == null || v === "") return "—";
    if (kind === "currency")
      return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v) || 0);
    if (kind === "date") {
      const s = String(v).slice(0, 10);
      const d = new Date(`${s}T00:00:00`);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(locale);
    }
    if (kind === "count") return new Intl.NumberFormat(locale).format(Number(v) || 0);
    return String(v);
  }

  const scopeLabel = target.bucket
    ? formatBucketLabel(target.bucket.raw, locale) === target.bucket.raw
      ? target.bucket.label
      : formatBucketLabel(target.bucket.raw, locale)
    : "Total";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">
              Détail — {entityLabel(target.query.entity)}
            </p>
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {scopeLabel}
              {target.title ? <span className="font-normal text-slate-400"> · {target.title}</span> : null}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {loading
                ? "Chargement…"
                : `${new Intl.NumberFormat(locale).format(total)} enregistrement${total > 1 ? "s" : ""}${truncated ? " (200 premiers affichés)" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-black/5 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">Chargement du détail…</div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-xs text-rose-500">{error}</div>
          ) : records.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">Aucun enregistrement.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  {columns.map((c) => (
                    <th key={c.id} className={`px-3 py-2 font-semibold ${c.kind === "currency" || c.kind === "count" ? "text-right" : ""}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/40">
                    {columns.map((c, ci) => (
                      <td
                        key={c.id}
                        className={`px-3 py-2 ${
                          c.kind === "currency" || c.kind === "count"
                            ? "text-right font-medium tabular-nums text-slate-900"
                            : "text-slate-700"
                        }`}
                      >
                        {fmtCell(row[ci], c.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
