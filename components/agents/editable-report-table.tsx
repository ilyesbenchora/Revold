"use client";

import { useState } from "react";

/**
 * B11 — Rapport en TABLEAU éditable : modifier/ajouter/supprimer des colonnes
 * + sélection en bulk (cocher) pour modifier/supprimer des lignes — même
 * logique de validation en masse que dans Enrichissement.
 *
 * Le composant est contrôlé : chaque modification remonte via onChange et le
 * parent persiste (rapport enregistré → saved_reports mis à jour).
 */
export type TablePatch = { columns: string[]; rows: (string | number)[][] };

const isNumeric = (cell: unknown) =>
  typeof cell === "string" || typeof cell === "number"
    ? /^-?[\d\s.,]+(?:\s*(?:€|%|k€|M€|j|jours))?$/.test(String(cell).trim())
    : false;

export function EditableReportTable({
  title,
  columns,
  rows,
  onChange,
}: {
  title?: string;
  columns: string[];
  rows: (string | number)[][];
  /** Absent → tableau en lecture seule (aucun contrôle d'édition affiché). */
  onChange?: (patch: TablePatch) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCol, setBulkCol] = useState(0);
  const [bulkValue, setBulkValue] = useState("");
  // Les inputs de cellules sont non contrôlés (commit au blur) : on force leur
  // remontage après chaque modification pour refléter les nouvelles valeurs.
  const [version, setVersion] = useState(0);

  const commit = (nextCols: string[], nextRows: (string | number)[][]) => {
    onChange?.({ columns: nextCols, rows: nextRows });
    setVersion((v) => v + 1);
  };

  const toggleRow = (ri: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ri)) next.delete(ri);
      else next.add(ri);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((_, i) => i))));

  const renameColumn = (ci: number, name: string) => {
    if (!name.trim() || name === columns[ci]) return;
    commit(columns.map((c, i) => (i === ci ? name.trim() : c)), rows);
  };

  const removeColumn = (ci: number) => {
    if (columns.length <= 1) return;
    setBulkCol(0);
    commit(columns.filter((_, i) => i !== ci), rows.map((r) => r.filter((_, i) => i !== ci)));
  };

  const addColumn = () => {
    commit([...columns, `Colonne ${columns.length + 1}`], rows.map((r) => [...r, "—"]));
  };

  const editCell = (ri: number, ci: number, value: string) => {
    if (String(rows[ri]?.[ci] ?? "") === value) return;
    commit(columns, rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r)));
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    commit(columns, rows.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  };

  const applyBulkValue = () => {
    if (selected.size === 0 || !bulkValue.trim()) return;
    commit(
      columns,
      rows.map((r, i) => (selected.has(i) ? r.map((c, j) => (j === bulkCol ? bulkValue.trim() : c)) : r)),
    );
    setBulkValue("");
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        {title && <div className="text-xs font-medium text-slate-600">{title}</div>}
        {onChange && (
          <button
            onClick={() => {
              setEditing((e) => !e);
              setSelected(new Set());
            }}
            className={`ml-auto rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
              editing
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {editing ? "✓ Terminer" : "✎ Modifier le tableau"}
          </button>
        )}
      </div>

      {/* Barre d'actions en masse — visible dès qu'au moins une ligne est cochée. */}
      {editing && selected.size > 0 && (
        <div className="mb-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 py-1.5 text-[11px]">
          <span className="font-semibold text-indigo-700">
            {selected.size} ligne{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={deleteSelected}
            className="rounded-md border border-rose-200 bg-white px-2 py-0.5 font-medium text-rose-600 hover:bg-rose-50"
          >
            🗑 Supprimer
          </button>
          <span className="ml-1 text-slate-400">ou modifier :</span>
          <select
            value={bulkCol}
            onChange={(e) => setBulkCol(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700"
          >
            {columns.map((c, i) => (
              <option key={i} value={i}>{c}</option>
            ))}
          </select>
          <input
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyBulkValue()}
            placeholder="Nouvelle valeur…"
            className="w-32 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700"
          />
          <button
            onClick={applyBulkValue}
            disabled={!bulkValue.trim()}
            className="rounded-md bg-accent px-2 py-0.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Appliquer
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table key={version} className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
              {editing && (
                <th className="w-8 px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleAll}
                    className="accent-indigo-500"
                    title="Tout sélectionner"
                  />
                </th>
              )}
              {columns.map((c, ci) => (
                <th key={ci} className="px-2.5 py-2 font-semibold">
                  {editing ? (
                    <span className="flex items-center gap-1">
                      <input
                        defaultValue={c}
                        onBlur={(e) => renameColumn(ci, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className="w-full min-w-16 rounded border border-slate-200 bg-white px-1 py-0.5 font-semibold uppercase tracking-wide"
                      />
                      {columns.length > 1 && (
                        <button
                          onClick={() => removeColumn(ci)}
                          className="rounded px-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Supprimer la colonne"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ) : (
                    c
                  )}
                </th>
              ))}
              {editing && (
                <th className="w-8 px-2 py-2">
                  <button
                    onClick={addColumn}
                    className="rounded-md border border-dashed border-indigo-300 px-1.5 py-0.5 text-indigo-500 hover:bg-indigo-50"
                    title="Ajouter une colonne"
                  >
                    +
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr
                key={ri}
                className={`border-b border-slate-100 transition last:border-0 ${
                  editing && selected.has(ri) ? "bg-indigo-50/60" : "hover:bg-indigo-50/40"
                }`}
              >
                {editing && (
                  <td className="px-2.5 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(ri)}
                      onChange={() => toggleRow(ri)}
                      className="accent-indigo-500"
                    />
                  </td>
                )}
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-2.5 py-1.5 ${
                      isNumeric(cell) ? "text-right font-medium tabular-nums text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {editing ? (
                      <input
                        defaultValue={String(cell ?? "")}
                        onBlur={(e) => editCell(ri, ci, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className={`w-full min-w-16 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-200 focus:border-indigo-300 focus:bg-white ${
                          isNumeric(cell) ? "text-right tabular-nums" : ""
                        }`}
                      />
                    ) : (
                      cell
                    )}
                  </td>
                ))}
                {editing && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
