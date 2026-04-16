"use client";

import { useRouter, useSearchParams } from "next/navigation";

const presets = [
  { id: "this_month", label: "Ce mois" },
  { id: "last_month", label: "Mois dernier" },
  { id: "this_quarter", label: "Ce trimestre" },
  { id: "last_quarter", label: "Trimestre dernier" },
  { id: "this_year", label: "Cette année" },
  { id: "last_6m", label: "6 mois" },
  { id: "all_time", label: "Tout" },
];

export function ReportDateRange() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("period") || "all_time";

  function handleChange(preset: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (preset === "all_time") {
      params.delete("period");
    } else {
      params.set("period", preset);
    }
    const qs = params.toString();
    router.push(`/dashboard/rapports/mes-rapports${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {presets.map((p) => (
        <button key={p.id} type="button" onClick={() => handleChange(p.id)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
            selected === p.id ? "bg-fuchsia-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function resolvePresetDates(preset: string): { from: string | null; to: string | null } {
  if (!preset || preset === "all_time") return { from: null, to: null };
  const now = new Date();
  const to = now.toISOString();
  let from: string;

  switch (preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    case "last_month": {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      return { from, to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString() };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1).toISOString();
      break;
    }
    case "last_quarter": {
      const cq = Math.floor(now.getMonth() / 3) * 3;
      return { from: new Date(now.getFullYear(), cq - 3, 1).toISOString(), to: new Date(now.getFullYear(), cq, 0).toISOString() };
    }
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1).toISOString();
      break;
    case "last_6m":
      from = new Date(Date.now() - 180 * 86400000).toISOString();
      break;
    default:
      return { from: null, to: null };
  }
  return { from, to };
}
