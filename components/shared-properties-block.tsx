"use client";

import { useState, useMemo } from "react";

type SharedProp = {
  name: string;
  label: string;
  objects: string[];
  type: string;
  sameLabel: boolean;
  isCustom: boolean;
  fillRate: number;
};

type Filter = "all" | "hubspot" | "custom";

const OBJ_LABELS: Record<string, string> = {
  contacts: "Contacts",
  companies: "Entreprises",
  deals: "Transactions",
  tickets: "Tickets",
};

const OBJ_COLORS: Record<string, string> = {
  contacts: "bg-blue-100 text-blue-700",
  companies: "bg-violet-100 text-violet-700",
  deals: "bg-orange-100 text-orange-700",
  tickets: "bg-emerald-100 text-emerald-700",
};

export function SharedPropertiesBlock({ properties }: { properties: SharedProp[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return properties;
    if (filter === "custom") return properties.filter((p) => p.isCustom);
    return properties.filter((p) => !p.isCustom);
  }, [properties, filter]);

  const customCount = properties.filter((p) => p.isCustom).length;
  const hubspotCount = properties.filter((p) => !p.isCustom).length;
  const onAll3 = filtered.filter((p) => p.objects.length === 3).length;
  const on2 = filtered.filter((p) => p.objects.length === 2).length;

  return (
    <div className="space-y-4">
      {/* KPIs + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-indigo-600 tabular-nums">{filtered.length}</p>
            <p className="text-[9px] text-indigo-500">Partagées</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-800 tabular-nums">{onAll3}</p>
            <p className="text-[9px] text-slate-500">3 objets</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-800 tabular-nums">{on2}</p>
            <p className="text-[9px] text-slate-500">2 objets</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === "all" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Toutes ({properties.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("hubspot")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === "hubspot" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            HubSpot ({hubspotCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("custom")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === "custom" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Custom ({customCount})
          </button>
        </div>
      </div>

      {/* Properties list */}
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">Aucune propriété dans ce filtre.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const rate = p.fillRate;
            const hasRate = rate >= 0;
            const barColor = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : rate >= 20 ? "bg-orange-400" : "bg-red-400";
            const textColor = rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : rate >= 20 ? "text-orange-500" : "text-red-500";

            return (
              <div key={p.name} className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-700 truncate">{p.label}</span>
                      <span className={`shrink-0 rounded px-1 py-px text-[8px] font-bold ${
                        p.isCustom ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                      }`}>
                        {p.isCustom ? "CUSTOM" : "HUBSPOT"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-400">{p.name} · {p.type}{!p.sameLabel && " · labels différents"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.objects.map((obj) => (
                      <span key={obj} className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${OBJ_COLORS[obj] ?? "bg-slate-100 text-slate-600"}`}>
                        {OBJ_LABELS[obj] ?? obj}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Fill rate gauge */}
                {hasRate && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${rate}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold tabular-nums ${textColor}`}>{rate} %</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
