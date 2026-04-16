"use client";

import { useState } from "react";

const presets = [
  { id: "this_month", label: "Ce mois" },
  { id: "last_month", label: "Mois dernier" },
  { id: "this_quarter", label: "Ce trimestre" },
  { id: "last_quarter", label: "Trimestre dernier" },
  { id: "this_year", label: "Cette année" },
  { id: "last_6m", label: "6 derniers mois" },
  { id: "all_time", label: "Tout" },
];

type Props = {
  onRangeChange?: (range: { preset: string; from: string | null; to: string | null }) => void;
};

function resolvePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let from: string;

  switch (preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      break;
    case "last_month": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      from = lm.toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to: end.toISOString().split("T")[0] };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1).toISOString().split("T")[0];
      break;
    }
    case "last_quarter": {
      const cq = Math.floor(now.getMonth() / 3) * 3;
      const lqs = new Date(now.getFullYear(), cq - 3, 1);
      const lqe = new Date(now.getFullYear(), cq, 0);
      return { from: lqs.toISOString().split("T")[0], to: lqe.toISOString().split("T")[0] };
    }
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      break;
    case "last_6m":
      from = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];
      break;
    default:
      return { from: "2020-01-01", to };
  }
  return { from, to };
}

export function ReportDateRange({ onRangeChange }: Props) {
  const [selected, setSelected] = useState("all_time");

  function handleChange(preset: string) {
    setSelected(preset);
    if (onRangeChange) {
      if (preset === "all_time") {
        onRangeChange({ preset, from: null, to: null });
      } else {
        const { from, to } = resolvePreset(preset);
        onRangeChange({ preset, from, to });
      }
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-medium text-slate-500 mr-1">Période :</span>
      {presets.map((p) => (
        <button key={p.id} type="button" onClick={() => handleChange(p.id)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
            selected === p.id ? "bg-accent text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
