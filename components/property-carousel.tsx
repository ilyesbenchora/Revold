"use client";

import { useState, useMemo } from "react";

type Property = {
  name: string;
  label: string;
  fillRate: number;
  isCustom: boolean;
};

type Filter = "all" | "hubspot" | "custom";

const PAGE_SIZE = 10;

export function PropertyCarousel({ properties }: { properties: Property[] }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return properties;
    if (filter === "custom") return properties.filter((p) => p.isCustom);
    return properties.filter((p) => !p.isCustom);
  }, [properties, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const customCount = properties.filter((p) => p.isCustom).length;
  const hubspotCount = properties.filter((p) => !p.isCustom).length;

  function switchFilter(f: Filter) {
    setFilter(f);
    setPage(0);
  }

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => switchFilter("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === "all" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Toutes ({properties.length})
          </button>
          <button
            type="button"
            onClick={() => switchFilter("hubspot")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === "hubspot" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            HubSpot ({hubspotCount})
          </button>
          <button
            type="button"
            onClick={() => switchFilter("custom")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              filter === "custom" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Personnalisées ({customCount})
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          {filtered.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur ${filtered.length}` : "0 résultats"}
        </p>
      </div>

      {/* Property list */}
      {visible.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">Aucune propriété dans ce filtre.</p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((prop, idx) => {
            const rank = page * PAGE_SIZE + idx + 1;
            const color = prop.fillRate >= 80 ? "bg-emerald-500" : prop.fillRate >= 50 ? "bg-amber-400" : prop.fillRate >= 20 ? "bg-orange-400" : "bg-red-400";
            const textColor = prop.fillRate >= 80 ? "text-emerald-600" : prop.fillRate >= 50 ? "text-amber-600" : prop.fillRate >= 20 ? "text-orange-500" : "text-red-500";

            return (
              <div key={prop.name} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-medium text-slate-400 w-5 text-right tabular-nums">{rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-700 truncate">{prop.label}</span>
                    <span className={`shrink-0 rounded px-1 py-px text-[8px] font-bold ${
                      prop.isCustom ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                    }`}>
                      {prop.isCustom ? "CUSTOM" : "HUBSPOT"}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${prop.fillRate}%` }} />
                  </div>
                </div>
                <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{prop.fillRate} %</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
          >
            ←
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
              // Show dots around current page
              const p = totalPages <= 10 ? i : (
                page < 5 ? i :
                page > totalPages - 6 ? totalPages - 10 + i :
                page - 4 + i
              );
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-1.5 w-1.5 rounded-full transition ${p === page ? "bg-accent" : "bg-slate-300 hover:bg-slate-400"}`}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
