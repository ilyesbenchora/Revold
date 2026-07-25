"use client";

import { useState } from "react";
import { ENTITY_DIMS, ENTITY_FIELDS, entityLabel, dimLabel, fieldLabel } from "@/lib/reports/data-table-presets";
import { InfoHint } from "@/components/info-hint";
import type { ChartQuery } from "@/lib/ai/agents/agent-runtime";

type Point = { name: string; value: number };

function measurePhrase(q: ChartQuery): string {
  const m = q.measure ?? "count";
  if (m === "count" || !q.field) return "Nombre de lignes";
  const f = fieldLabel(q.entity, q.field);
  if (m === "avg") return `Moyenne · ${f}`;
  if (m === "weighted") return `Projection pondérée · ${f}`;
  return `Somme · ${f}`;
}

function unitOf(q: ChartQuery): string {
  if ((q.measure ?? "count") === "count" || !q.field) return "count";
  return ENTITY_FIELDS[q.entity]?.find((f) => f.id === q.field)?.unit ?? "count";
}

function fmtTotal(v: number, unit: string): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

/**
 * Vérification du câblage d'un graphique créé par un agent (chat, rapports,
 * prévisions) : même logique que l'étape Vérification des tables de données —
 * la ligne repliée résume le câblage réel (source · regroupement · mesure) ;
 * dépliée, regroupement et mesure sont corrigeables, avec recalcul déterministe
 * immédiat de la visualisation (aucun re-passage par l'agent).
 */
export function ChartWiringPanel({
  label,
  query,
  sources = [],
  period,
  onApply,
}: {
  /** Nom du bloc quand le rapport en contient plusieurs. */
  label?: string;
  query: ChartQuery;
  sources?: string[];
  /** Période active du rapport — le recalcul la respecte. */
  period?: { from?: string | null; to?: string | null; all?: boolean } | null;
  onApply: (query: ChartQuery, data: Point[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<ChartQuery>(query);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unit = unitOf(q);
  const dims = ENTITY_DIMS[q.entity] ?? [];
  const dimOpts = dims.some((d) => d.id === q.groupBy)
    ? dims
    : [{ id: q.groupBy, label: dimLabel(q.entity, q.groupBy) }, ...dims];
  const fields = ENTITY_FIELDS[q.entity] ?? [];

  async function recompute(nq: ChartQuery) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: nq,
          sources,
          all: period?.all ?? !period?.from,
          date_from: period?.from ?? undefined,
          date_to: period?.to ?? undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Recalcul impossible");
      const data = (d.data ?? []) as Point[];
      setQ(nq);
      setRowCount(Number(d.totalRows) || 0);
      setTotal(data.reduce((s, r) => s + (Number(r.value) || 0), 0));
      onApply(nq, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recalcul impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] text-slate-500 transition hover:text-slate-700"
      >
        <span aria-hidden>✨</span>
        <span className="min-w-0 flex-1 truncate">
          {label ? <span className="font-medium text-slate-600">{label} — </span> : null}
          Câblage : <span className="font-medium text-slate-700">{entityLabel(q.entity)}</span> · {dimLabel(q.entity, q.groupBy)} · {measurePhrase(q)}
        </span>
        <span className="shrink-0 font-medium text-indigo-500">{open ? "Fermer" : "Vérifier / corriger"}</span>
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-indigo-100 px-2.5 py-2.5">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-slate-500">Source de données</dt>
              <dd className="text-xs font-semibold text-slate-900">{entityLabel(q.entity)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                Regroupement
                <InfoHint text="Définit les LIGNES du graphique (axe horizontal) : un point/barre par mois, par statut, par catégorie…" />
              </dt>
              <dd className="min-w-0">
                <select
                  value={q.groupBy}
                  disabled={loading}
                  onChange={(e) => recompute({ ...q, groupBy: e.target.value })}
                  className="w-full max-w-52 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                >
                  {dimOpts.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                Mesure
                <InfoHint text="Définit la valeur calculée pour chaque ligne (hauteur des barres / points de la courbe) : nombre d'éléments, ou somme/moyenne du champ choisi." />
              </dt>
              <dd className="min-w-0">
                <select
                  value={`${q.measure ?? "count"}:${q.field ?? ""}`}
                  disabled={loading}
                  onChange={(e) => {
                    const [measure, field] = e.target.value.split(":");
                    recompute({ ...q, measure, field: field || undefined });
                  }}
                  className="w-full max-w-52 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                >
                  <option value="count:">Nombre de lignes</option>
                  {fields.map((f) => (
                    <optgroup key={f.id} label={f.label}>
                      <option value={`sum:${f.id}`}>Somme · {f.label}</option>
                      <option value={`avg:${f.id}`}>Moyenne · {f.label}</option>
                    </optgroup>
                  ))}
                  {(q.measure === "weighted") && (
                    <option value={`weighted:${q.field ?? ""}`}>Projection pondérée</option>
                  )}
                </select>
              </dd>
            </div>
            {rowCount != null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-slate-500">Données trouvées</dt>
                <dd className={`text-xs font-semibold ${rowCount > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {loading ? "…" : `${new Intl.NumberFormat("fr-FR").format(rowCount)} ligne${rowCount > 1 ? "s" : ""}`}
                </dd>
              </div>
            )}
            {total != null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-slate-500">Total calculé</dt>
                <dd className="text-xs font-semibold text-emerald-600">{loading ? "…" : fmtTotal(total, unit)}</dd>
              </div>
            )}
          </dl>
          {error && <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-600">{error}</p>}
          <p className="text-[10px] text-slate-400">
            Chaque correction recalcule la visualisation à la source, en direct — la donnée affichée est exactement celle du câblage ci-dessus.
          </p>
        </div>
      )}
    </div>
  );
}
