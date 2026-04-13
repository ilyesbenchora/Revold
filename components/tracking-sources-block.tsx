"use client";

import { useState } from "react";

type SourceStat = { source: string; label: string; count: number; pct: number };
type DrillDown = { value: string; count: number; pct: number };

type Props = {
  sources: SourceStat[];
  drillDown1: DrillDown[];
  drillDown2: DrillDown[];
  total: number;
};

type Tab = "source" | "dd1" | "dd2";

function BarList({ items }: { items: Array<{ label: string; count: number; pct: number }> }) {
  const maxCount = Math.max(...items.map((s) => s.count), 1);
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-700 truncate" title={s.label}>{s.label}</span>
            <span className="shrink-0 ml-2 text-[11px] text-slate-600 tabular-nums">
              {s.count.toLocaleString("fr-FR")} <span className="text-slate-400">({s.pct} %)</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.max(0.5, (s.count / maxCount) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrackingSourcesBlock({ sources, drillDown1, drillDown2, total }: Props) {
  const [tab, setTab] = useState<Tab>("source");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab("source")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              tab === "source" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Source d&apos;origine
          </button>
          <button
            type="button"
            onClick={() => setTab("dd1")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              tab === "dd1" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Source d&apos;origine 1
          </button>
          <button
            type="button"
            onClick={() => setTab("dd2")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              tab === "dd2" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Source d&apos;origine 2
          </button>
        </div>
        <p className="text-[10px] text-slate-400">{total.toLocaleString("fr-FR")} contacts</p>
      </div>

      {tab === "source" && (
        <BarList items={sources.map((s) => ({ label: s.label, count: s.count, pct: s.pct }))} />
      )}
      {tab === "dd1" && (
        drillDown1.length > 0
          ? <BarList items={drillDown1.map((d) => ({ label: d.value, count: d.count, pct: d.pct }))} />
          : <p className="py-4 text-center text-xs text-slate-400">Aucune donnée</p>
      )}
      {tab === "dd2" && (
        drillDown2.length > 0
          ? <BarList items={drillDown2.map((d) => ({ label: d.value, count: d.count, pct: d.pct }))} />
          : <p className="py-4 text-center text-xs text-slate-400">Aucune donnée</p>
      )}
    </div>
  );
}
