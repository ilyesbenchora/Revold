"use client";

import { useEffect, useState } from "react";
import {
  blockSourceKey,
  SurgicalAlertButton,
  type SurgicalAggSpec,
  type SurgicalUnit,
} from "./surgical-alert-button";
import { ReportPeriodBar, type AppliedPeriod } from "@/components/agents/report-period-bar";

/**
 * Spec de RECALCUL d'une ligne (période / cohorte à la consultation) : la
 * ligne est reproductible par computeAggregate — valeur = bucket `target`,
 * sinon somme des buckets (count/sum), × multiplier éventuel (MRR → ARR).
 * Les lignes SANS spec (composites : marges, écarts, médianes…) affichent
 * « — » quand un filtre est actif : jamais un chiffre faux.
 */
export type BlockRowSpec = {
  entity: string;
  groupBy: string;
  measure: "count" | "sum" | "weighted";
  field?: string | null;
  target?: string | null;
  multiplier?: number | null;
  pipeline?: string | null;
};

// Options/valeurs de cohortes : helpers partagés (cache module par page).
// Options = UNIQUEMENT les cohortes enregistrées dans Paramètres → Cohortes.
import { fetchCohortOptions, fetchCohortValues, type CohortOption } from "@/lib/reports/cohort-filter-client";

/**
 * Cellule additionnelle : une valeur brute, ou un lien (deep link HubSpot,
 * fiche interne…) quand la table remplace un rendu qui en proposait un.
 */
export type BlockTableCell = string | number | null | { label: string | number; href: string };

export type BlockTableRow = {
  /** Libellé de la ligne — c'est aussi la cible sélectionnable dans l'alerte. */
  name: string;
  /** Valeur principale. `null` = non calculable (affichée « — », non alertable). */
  value: number | null;
  /** Unité propre à la ligne, si le bloc mélange des unités (MRR + taux de churn…). */
  unit?: SurgicalUnit;
  /** Colonnes additionnelles, alignées sur `extraColumns`. */
  cells?: BlockTableCell[];
  /**
   * Couleur de la valeur : "auto" = vert si > 0 / rouge si < 0 (balances,
   * résultats…), "pos"/"neg" = forcée (encaissements, charges…).
   */
  tone?: "auto" | "pos" | "neg";
  /** Spec de recalcul (période / cohorte) — absent = ligne composite, non filtrable. */
  spec?: BlockRowSpec;
};

/** Classe couleur de la valeur selon la tonalité demandée et le signe. */
function valueToneClass(row: BlockTableRow): string {
  if (row.value === null || !row.tone) return "text-slate-900";
  if (row.tone === "pos") return "text-emerald-600";
  if (row.tone === "neg") return "text-rose-600";
  // auto
  if (row.value > 0) return "text-emerald-600";
  if (row.value < 0) return "text-rose-600";
  return "text-slate-900";
}

function renderCell(cell: BlockTableCell) {
  if (cell === null || cell === undefined) return "—";
  if (typeof cell === "object") {
    return (
      <a
        href={cell.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline decoration-dotted underline-offset-2 hover:text-fuchsia-600"
      >
        {cell.label}
      </a>
    );
  }
  return cell;
}

export function formatBlockValue(v: number | null, unit: SurgicalUnit): string {
  if (v === null || Number.isNaN(v)) return "—";
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

/**
 * Rend n'importe quel bloc métier (pipeline, funnel de conversion, synthèse
 * facturation…) sous forme de table {libellé, valeur} normalisée, avec le CTA
 * d'alerte chirurgicale. Les données ne sont PAS recalculées : le bloc passe
 * exactement les lignes qu'il affiche déjà.
 */
export function BlockDataTable({
  title,
  subtitle,
  rows,
  team,
  unit = "count",
  aggSpec,
  nameLabel = "Donnée",
  valueLabel = "Valeur",
  extraColumns = [],
  footnote,
  showTotal = false,
  emptyLabel = "Aucune donnée à afficher pour ce bloc.",
  sources = [],
}: {
  title: string;
  subtitle?: string;
  rows: BlockTableRow[];
  /** Équipe de rattachement de l'alerte : sales | marketing | finance | csm | revops. */
  team: string;
  /** Unité par défaut des lignes qui n'en déclarent pas. */
  unit?: SurgicalUnit;
  /** Fourni uniquement si les lignes sont reproductibles par `computeAggregate`. */
  aggSpec?: SurgicalAggSpec;
  nameLabel?: string;
  valueLabel?: string;
  extraColumns?: string[];
  footnote?: string;
  /** true seulement si toutes les lignes partagent la même unité additive. */
  showTotal?: boolean;
  emptyLabel?: string;
  /** Outils sources du bloc (filtre appliqué au recalcul période/cohorte). */
  sources?: string[];
}) {
  // ── Consultation : période + cohorte quand au moins une ligne a un spec.
  // Sans filtre actif : les valeurs SERVEUR d'origine, à l'identique.
  const filterable = rows.some((r) => r.spec);
  const [period, setPeriod] = useState<AppliedPeriod | null>(null);
  const [cohortKey, setCohortKey] = useState<string | null>(null);
  const [cohortValue, setCohortValue] = useState<string | null>(null);
  const [cohortOptions, setCohortOptions] = useState<CohortOption[]>([]);
  const [cohortVals, setCohortVals] = useState<string[]>([]);
  const [recomputing, setRecomputing] = useState(false);
  // Valeurs recalculées par nom de ligne (null = non calculable) — actives
  // uniquement quand un filtre l'est.
  const [override, setOverride] = useState<Map<string, number | null> | null>(null);
  // Barre repliable, mémorisée par bloc et par navigateur (localStorage).
  const storageKey = `revold:block-filters:${blockSourceKey(title, subtitle)}`;
  const [showFilters, setShowFilters] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(storageKey) === "0") setShowFilters(false); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function toggleFilters() {
    setShowFilters((v) => {
      try { localStorage.setItem(storageKey, v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }
  useEffect(() => {
    if (filterable) void fetchCohortOptions().then(setCohortOptions);
  }, [filterable]);

  const activeCohort = cohortKey && cohortValue ? { key: cohortKey, value: cohortValue } : null;
  const filtersActive = (period !== null && period.preset !== "all") || activeCohort !== null;

  async function recompute(p: AppliedPeriod | null, co: { key: string; value: string } | null) {
    const active = (p !== null && p.preset !== "all") || co !== null;
    if (!active) { setOverride(null); return; }
    setRecomputing(true);
    try {
      const next = new Map<string, number | null>();
      await Promise.all(
        rows.map(async (r) => {
          if (!r.spec) { next.set(r.name, null); return; }
          try {
            const res = await fetch("/api/reports/recompute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: {
                  entity: r.spec.entity, groupBy: r.spec.groupBy, measure: r.spec.measure,
                  field: r.spec.field ?? undefined, pipeline: r.spec.pipeline ?? null, cohort: co,
                },
                sources,
                all: !p || p.preset === "all",
                date_from: p?.from,
                date_to: p?.to,
              }),
            });
            const d = await res.json();
            if (!res.ok) { next.set(r.name, null); return; }
            const buckets = (Array.isArray(d.data) ? d.data : []) as { name: string; value: number }[];
            const raw = r.spec.target != null
              ? (buckets.find((b) => b.name === r.spec!.target)?.value ?? 0)
              : buckets.reduce((s, b) => s + (b.value || 0), 0);
            next.set(r.name, Math.round(raw * (r.spec.multiplier ?? 1)));
          } catch {
            next.set(r.name, null);
          }
        }),
      );
      setOverride(next);
    } finally {
      setRecomputing(false);
    }
  }

  function applyPeriod(p: AppliedPeriod) {
    const normalized = p.preset === "all" ? null : p;
    setPeriod(normalized);
    void recompute(normalized, activeCohort);
  }
  function applyCohortKey(key: string | null) {
    setCohortKey(key);
    setCohortValue(null);
    if (key) void fetchCohortValues(key).then(setCohortVals);
    if (!key || cohortValue) void recompute(period, null);
  }
  function applyCohortValue(v: string | null) {
    setCohortValue(v);
    void recompute(period, cohortKey && v ? { key: cohortKey, value: v } : null);
  }

  // Lignes affichées : valeurs serveur, remplacées par le recalcul si filtre actif.
  const shownRows = filtersActive && override
    ? rows.map((r) => ({ ...r, value: override.get(r.name) ?? null }))
    : rows;

  const alertRows = shownRows
    .filter((r) => typeof r.value === "number" && !Number.isNaN(r.value))
    .map((r) => ({ name: r.name, value: r.value as number }));

  const total = showTotal ? alertRows.reduce((s, r) => s + r.value, 0) : null;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-card-border bg-slate-50/60 px-4 py-2.5">
        <div className="min-w-0">
          <h4 className="truncate text-xs font-semibold text-slate-800">{title}</h4>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {subtitle ? `${subtitle} · ` : ""}
            {rows.length} ligne{rows.length > 1 ? "s" : ""}
            {total !== null && <> · total {formatBlockValue(total, unit)}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {filterable && (
            <button
              onClick={toggleFilters}
              title={showFilters ? "Masquer les filtres (rendu propre)" : "Afficher les filtres"}
              aria-pressed={!showFilters}
              className={`rounded-lg p-1.5 transition ${
                showFilters ? "text-slate-300 hover:bg-slate-100 hover:text-slate-500" : "bg-slate-100 text-slate-500 hover:text-slate-700"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            </button>
          )}
          <SurgicalAlertButton
            title={title}
            scopeLabel={`la table « ${title} »${subtitle ? ` (${subtitle})` : ""}`}
            impactScope={`la table ${title}`}
            rows={alertRows}
            team={team}
            unit={unit}
            aggSpec={aggSpec}
            allowTotal={showTotal}
            sourceKey={blockSourceKey(title, subtitle)}
          />
        </div>
      </div>

      {/* ── Barre de consultation (période + cohorte) : lignes reproductibles
             recalculées, composites en « — » (jamais un chiffre faux). ── */}
      {filterable && showFilters && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-4 py-2">
          <ReportPeriodBar
            onApply={applyPeriod}
            loading={recomputing}
            activeLabel={period?.label ?? "Toutes périodes"}
            applied={period ?? { preset: "all", from: "", to: "", label: "Toutes les données" }}
          />
          {cohortOptions.length > 0 && (
          <label className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            Cohorte
            <select
              value={cohortKey ?? ""}
              disabled={recomputing}
              onChange={(e) => applyCohortKey(e.target.value || null)}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 outline-none focus:border-accent"
            >
              <option value="">Aucune</option>
              {cohortOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {cohortKey && (
              <select
                value={cohortValue ?? ""}
                disabled={recomputing}
                onChange={(e) => applyCohortValue(e.target.value || null)}
                className="max-w-40 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 outline-none focus:border-accent"
              >
                <option value="">Toutes les valeurs</option>
                {(cohortVals.length > 0 ? cohortVals : cohortValue ? [cohortValue] : []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
          </label>
          )}
          {recomputing && <span className="text-[11px] text-slate-400">Recalcul…</span>}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white text-left text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">{nameLabel}</th>
                <th className="px-4 py-2 text-right font-medium">{valueLabel}</th>
                {extraColumns.map((c) => (
                  <th key={c} className="px-4 py-2 text-right font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownRows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{r.name || "—"}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${valueToneClass(r)}`}>
                    {formatBlockValue(r.value, r.unit ?? unit)}
                  </td>
                  {extraColumns.map((c, ci) => (
                    <td key={c} className="px-4 py-2 text-right text-slate-600">
                      {renderCell(r.cells?.[ci] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtersActive && shownRows.some((r) => !r.spec) && (
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-amber-600">
          Les lignes « — » sont des indicateurs composites, non recalculables sur la période/cohorte choisie.
        </p>
      )}
      {footnote && (
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">{footnote}</p>
      )}
    </div>
  );
}
