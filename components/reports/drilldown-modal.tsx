"use client";

import { useEffect, useMemo, useState } from "react";
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

type DetailColumn = { id: string; label: string; kind?: "text" | "currency" | "date" | "count" | "percent"; default?: boolean };

/** Choix de colonnes mémorisé par entité (deals, invoices…). */
function colsStorageKey(entity: string) {
  return `revold:drill-cols:${entity}`;
}
function readStoredCols(entity: string): string[] | null {
  try {
    const raw = localStorage.getItem(colsStorageKey(entity));
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.every((x) => typeof x === "string") ? arr : null;
  } catch {
    return null;
  }
}
function writeStoredCols(entity: string, ids: string[]) {
  try {
    localStorage.setItem(colsStorageKey(entity), JSON.stringify(ids));
  } catch {}
}

/**
 * DÉTAIL D'UN CHIFFRE (drill-down) : au clic sur une barre, un segment de
 * donut, un point de courbe, une ligne de table ou un total, ce modal liste
 * les enregistrements sous-jacents (contacts, deals, factures, abonnements,
 * transactions…) — mêmes filtres déterministes que le rapport.
 *
 * Les colonnes sont personnalisables (« Colonnes ») : retirables et
 * complétables via les suggestions du catalogue de l'entité du rapport
 * (ex. deals → Pipeline, Probabilité). Choix mémorisé par entité.
 * Le serveur renvoie toutes les valeurs : l'affichage filtre sans re-requête.
 */
export function DrilldownModal({ target, onClose }: { target: DrilldownTarget | null; onClose: () => void }) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<DetailColumn[]>([]);
  const [records, setRecords] = useState<unknown[][]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  // Personnalisation des colonnes affichées (null = défauts du catalogue).
  const [selectedCols, setSelectedCols] = useState<string[] | null>(null);
  const [colsOpen, setColsOpen] = useState(false);

  const entity = target?.query.entity ?? "";

  useEffect(() => {
    if (!target) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setRecords([]);
    setColsOpen(false);
    setSelectedCols(readStoredCols(target.query.entity));
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

  // Colonnes visibles : choix mémorisé (∩ catalogue), sinon défauts du serveur.
  const visible = useMemo(() => {
    if (columns.length === 0) return [] as { col: DetailColumn; idx: number }[];
    const ids = selectedCols?.filter((id) => columns.some((c) => c.id === id));
    const activeIds = ids && ids.length > 0 ? ids : columns.filter((c) => c.default !== false).map((c) => c.id);
    return columns
      .map((col, idx) => ({ col, idx }))
      .filter(({ col }) => activeIds.includes(col.id));
  }, [columns, selectedCols]);

  if (!target || typeof document === "undefined") return null;

  function toggleCol(id: string) {
    const current = visible.map(({ col }) => col.id);
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    if (next.length === 0) return; // toujours au moins une colonne
    setSelectedCols(next);
    writeStoredCols(entity, next);
  }

  function fmtCell(v: unknown, kind?: DetailColumn["kind"]): string {
    if (v == null || v === "") return "—";
    if (kind === "currency")
      return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v) || 0);
    if (kind === "percent") return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(v) || 0)} %`;
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
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-card-border bg-slate-50/70 px-5 py-3.5">
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
          <div className="relative flex shrink-0 items-center gap-2">
            {/* Personnalisation des colonnes (retirer / ajouter les suggestions de l'entité) */}
            {!loading && !error && columns.length > 0 && (
              <button
                type="button"
                onClick={() => setColsOpen((o) => !o)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  colsOpen
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                }`}
              >
                Colonnes ({visible.length}) ▾
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-black/5 hover:text-slate-800"
            >
              ✕
            </button>
            {colsOpen && (
              <div className="absolute right-0 top-9 z-10 w-56 rounded-xl border border-card-border bg-card p-2 shadow-xl">
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Colonnes affichées
                </p>
                {columns.map((c) => {
                  const on = visible.some(({ col }) => col.id === c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                    >
                      <input type="checkbox" checked={on} onChange={() => toggleCol(c.id)} className="accent-[var(--accent)]" />
                      <span className="flex-1">{c.label}</span>
                      {c.default === false && !on && (
                        <span className="rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-medium text-indigo-500">suggestion</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto" onClick={() => colsOpen && setColsOpen(false)}>
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
                  {visible.map(({ col }) => (
                    <th
                      key={col.id}
                      className={`px-3 py-2 font-semibold ${col.kind === "currency" || col.kind === "count" || col.kind === "percent" ? "text-right" : ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/40">
                    {visible.map(({ col, idx }) => (
                      <td
                        key={col.id}
                        className={`px-3 py-2 ${
                          col.kind === "currency" || col.kind === "count" || col.kind === "percent"
                            ? "text-right font-medium tabular-nums text-slate-900"
                            : "text-slate-700"
                        }`}
                      >
                        {fmtCell(row[idx], col.kind)}
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
    // Monté DANS .dashboard-shell : le thème (mode sombre violet) s'applique au
    // modal — porté sur document.body il restait blanc, hors du scope du remap.
    document.querySelector(".dashboard-shell") ?? document.body,
  );
}
