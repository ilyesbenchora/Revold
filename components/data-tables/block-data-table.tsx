"use client";

import {
  blockSourceKey,
  SurgicalAlertButton,
  type SurgicalAggSpec,
  type SurgicalUnit,
} from "./surgical-alert-button";

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
};

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
}) {
  const alertRows = rows
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
              {rows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{r.name || "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">
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

      {footnote && (
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">{footnote}</p>
      )}
    </div>
  );
}
