"use client";

import { useState } from "react";

type Property = {
  name: string;
  label: string;
  fillRate: number;
  isCustom: boolean;
};

const PAGE_SIZE = 10;

export function PropertyCarousel({ properties }: { properties: Property[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(properties.length / PAGE_SIZE);
  const visible = properties.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, properties.length)} sur {properties.length} propriétés
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className={`h-1.5 w-1.5 rounded-full transition ${i === page ? "bg-accent" : "bg-slate-300"}`}
            />
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>

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
    </div>
  );
}
