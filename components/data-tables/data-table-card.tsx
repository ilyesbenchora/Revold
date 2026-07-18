"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportChart } from "@/components/agents/agent-report";
import { ReportPeriodBar, type AppliedPeriod } from "@/components/agents/report-period-bar";
import type { ReportBlock } from "@/lib/ai/agents/agent-runtime";

export type SavedTable = {
  id: string;
  title: string;
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string | null;
  view: string;
  custom_kpi?: string | null;
};

type Row = { name: string; value: number };

function formatValue(v: number, unit: string | null): string {
  if (unit === "currency") return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toFixed(1)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

export function DataTableCard({
  table,
  onDeleted,
  onEdit,
}: {
  table: SavedTable;
  onDeleted: (id: string) => void;
  onEdit: (table: SavedTable) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AppliedPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (p: AppliedPeriod | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { entity: table.entity, groupBy: table.group_by, measure: table.measure, field: table.field },
          all: !p,
          date_from: p?.from,
          date_to: p?.to,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur de calcul");
      setRows(Array.isArray(d.data) ? d.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [table.entity, table.group_by, table.measure, table.field]);

  useEffect(() => { load(null); }, [load]);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const res = await fetch(`/api/page-tables/${table.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(table.id);
    else setDeleting(false);
  }

  const total = rows.reduce((s, r) => s + (r.value || 0), 0);
  const isChart = table.view === "bar" || table.view === "line" || table.view === "donut";
  const block: ReportBlock = { type: table.view as ReportBlock["type"], title: table.title, data: rows };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{table.title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {table.entity} · groupé par {table.group_by}
            {rows.length > 0 && <> · total {formatValue(total, table.unit_mode)}</>}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onEdit(table)}
            title="Modifier la table"
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-indigo-50 hover:text-accent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
          <button
            onClick={remove}
            disabled={deleting}
            title="Supprimer la table"
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <ReportPeriodBar
          onApply={(p) => { setPeriod(p); load(p); }}
          loading={loading}
          activeLabel={period?.label ?? "Toutes périodes"}
        />
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-400">Calcul en cours…</div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-xs text-rose-500">{error}</div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-400">Aucune donnée sur cette période.</div>
        ) : isChart ? (
          <ReportChart block={block} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">{table.group_by}</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="px-3 py-2 text-slate-700">{r.name || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{formatValue(r.value, table.unit_mode)}</td>
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
