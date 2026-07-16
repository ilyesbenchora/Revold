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

export function ChartPicker({ proposal }: { proposal: ChartProposal }) {
  const types = proposal.suggestedTypes.length ? proposal.suggestedTypes : ["bar"];
  const [type, setType] = useState(proposal.defaultType || types[0]);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Graphique</div>
      <h3 className="text-sm font-semibold text-slate-900">{proposal.title}</h3>
      {proposal.summary && <p className="mt-0.5 text-sm text-slate-600">{proposal.summary}</p>}

      {/* Le format par défaut choisi par l'agent est déjà affiché ci-dessous ;
          ces boutons sont une option discrète pour changer, pas une question. */}
      {types.length > 1 && (
        <div className="mt-3 mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">Autre format :</span>
          {types.map((t) => {
            const m = TYPE_META[t] ?? { icon: "▦", label: t };
            const on = t === type;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                  on
                    ? "border-indigo-300 bg-white text-accent ring-1 ring-indigo-200"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs">{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-[var(--card-border)] bg-white p-2">
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
