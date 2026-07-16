"use client";

import { useState } from "react";
import { ReportChart } from "./agent-report";
import type { ChartProposal, ReportBlock } from "@/lib/ai/agents/agent-runtime";

const TYPE_META: Record<string, { icon: string; label: string }> = {
  bar: { icon: "📊", label: "Barres" },
  line: { icon: "📈", label: "Courbe" },
  area: { icon: "🌄", label: "Aire" },
  donut: { icon: "🍩", label: "Donut" },
  table: { icon: "▦", label: "Table" },
  kpi: { icon: "🔢", label: "Indicateur" },
};

// Tous les formats proposés à l'utilisateur (ordre d'affichage).
const ALL_TYPES = ["bar", "line", "area", "donut", "table", "kpi"];

export function ChartPicker({
  proposal,
  onTypeChange,
}: {
  proposal: ChartProposal;
  onTypeChange?: (t: string) => void;
}) {
  // On propose systématiquement TOUS les formats (Courbe et Indicateur inclus),
  // en gardant en premier ceux suggérés par l'agent.
  const suggested = proposal.suggestedTypes.filter((t) => ALL_TYPES.includes(t));
  const types = [...suggested, ...ALL_TYPES.filter((t) => !suggested.includes(t))];
  const [type, setType] = useState(proposal.defaultType || suggested[0] || types[0]);

  function pick(t: string) {
    setType(t);
    onTypeChange?.(t);
  }

  const total = proposal.data.reduce((s, d) => s + (typeof d.value === "number" ? d.value : 0), 0);
  const avg = proposal.data.length ? total / proposal.data.length : 0;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
        Graphique · choisis le format
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{proposal.title}</h3>
      {proposal.summary && <p className="mt-0.5 text-sm text-slate-600">{proposal.summary}</p>}

      <div className="mt-3 mb-2 flex flex-wrap gap-2">
        {types.map((t) => {
          const m = TYPE_META[t] ?? { icon: "▦", label: t };
          const on = t === type;
          return (
            <button
              key={t}
              onClick={() => pick(t)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                on
                  ? "border-indigo-300 bg-white text-accent ring-1 ring-indigo-200"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm">{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-white p-2">
        {type === "table" ? (
          <table className="w-full text-left text-xs">
            <tbody>
              {proposal.data.map((d, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5 text-slate-700">{d.name}</td>
                  <td className="px-2 py-1.5 text-right font-medium text-slate-900">
                    {d.value.toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : type === "kpi" ? (
          <div className="grid grid-cols-3 gap-2 p-2">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{Math.round(total).toLocaleString("fr-FR")}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Moyenne</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{Math.round(avg).toLocaleString("fr-FR")}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Éléments</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{proposal.data.length}</p>
            </div>
          </div>
        ) : (
          <ReportChart block={{ type: type as ReportBlock["type"], data: proposal.data }} />
        )}
      </div>
    </div>
  );
}
