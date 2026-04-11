"use client";

import { useState } from "react";

export const REPORT_DISPLAY_CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "attribution", label: "Attribution" },
  { id: "chiffre_affaires", label: "Chiffre d'affaires" },
  { id: "facturation_paiement", label: "Facturation & Paiement" },
  { id: "service_client", label: "Service client" },
  { id: "qualite_donnees", label: "Qualité de données" },
  { id: "adoption_outils", label: "Adoption outils" },
  { id: "cycle_ventes", label: "Cycle de ventes" },
] as const;

export type ReportDisplayCategory = (typeof REPORT_DISPLAY_CATEGORIES)[number]["id"];

type Props = {
  counts: Record<string, number>;
  children: (activeCategory: string) => React.ReactNode;
};

export function ReportCategoryFilter({ counts, children }: Props) {
  const [active, setActive] = useState<string>("all");

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {REPORT_DISPLAY_CATEGORIES.map((cat) => {
          const count = cat.id === "all" ? total : (counts[cat.id] ?? 0);
          if (cat.id !== "all" && count === 0) return null;
          const isActive = active === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : "bg-white border border-card-border text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {children(active)}
    </div>
  );
}
