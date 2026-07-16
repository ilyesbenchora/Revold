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
};

/**
 * Graphique proposé par l'agent : l'UTILISATEUR choisit le format d'affichage
 * parmi les options. `onTypeChange` remonte le choix (pour l'enregistrer tel quel).
 */
export function ChartPicker({
  proposal,
  onTypeChange,
}: {
  proposal: ChartProposal;
  onTypeChange?: (t: string) => void;
}) {
  const types = proposal.suggestedTypes.length ? proposal.suggestedTypes : ["bar"];
  const [type, setType] = useState(proposal.defaultType || types[0]);

  function pick(t: string) {
    setType(t);
    onTypeChange?.(t);
  }

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
        ) : (
          <ReportChart block={{ type: type as ReportBlock["type"], data: proposal.data }} />
        )}
      </div>
    </div>
  );
}
