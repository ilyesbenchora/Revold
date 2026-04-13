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
type ObjFilter = "all" | "3" | "2";

const PAGE_SIZE = 10;

const OBJ_LABELS: Record<string, string> = {
  contacts: "Contacts",
  companies: "Entreprises",
  deals: "Transactions",
};

const OBJ_COLORS: Record<string, string> = {
  contacts: "bg-blue-100 text-blue-700",
  companies: "bg-violet-100 text-violet-700",
  deals: "bg-orange-100 text-orange-700",
};

type SortDir = "desc" | "asc";

export function SharedPropertiesBlock({ properties }: { properties: SharedProp[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [objFilter, setObjFilter] = useState<ObjFilter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = properties;
    if (filter === "custom") list = list.filter((p) => p.isCustom);
    else if (filter === "hubspot") list = list.filter((p) => !p.isCustom);
    if (objFilter === "3") list = list.filter((p) => p.objects.length >= 3);
    else if (objFilter === "2") list = list.filter((p) => p.objects.length === 2);
    return sortDir === "desc"
      ? [...list].sort((a, b) => b.fillRate - a.fillRate)
      : [...list].sort((a, b) => a.fillRate - b.fillRate);
  }, [properties, filter, objFilter, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const customCount = properties.filter((p) => p.isCustom).length;
  const hubspotCount = properties.filter((p) => !p.isCustom).length;
  const onAll3 = properties.filter((p) => p.objects.length >= 3).length;
  const on2 = properties.filter((p) => p.objects.length === 2).length;

  function switchFilter(f: Filter) { setFilter(f); setPage(0); }
  function switchObj(o: ObjFilter) { setObjFilter(objFilter === o ? "all" : o); setPage(0); }

  return (
    <div className="space-y-3">
      {/* KPIs + filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setObjFilter("all"); setPage(0); }}
            className={`rounded-lg px-3 py-2 text-center transition ${objFilter === "all" ? "bg-indigo-100 ring-2 ring-indigo-400" : "bg-indigo-50 hover:bg-indigo-100"}`}>
            <p className="text-lg font-bold text-indigo-600 tabular-nums">{properties.length}</p>
            <p className="text-[9px] text-indigo-500">Partagées</p>
          </button>
          <button type="button" onClick={() => switchObj("3")}
            className={`rounded-lg px-3 py-2 text-center transition ${objFilter === "3" ? "bg-slate-200 ring-2 ring-slate-400" : "bg-slate-50 hover:bg-slate-100"}`}>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{onAll3}</p>
            <p className="text-[9px] text-slate-500">3 objets</p>
          </button>
          <button type="button" onClick={() => switchObj("2")}
            className={`rounded-lg px-3 py-2 text-center transition ${objFilter === "2" ? "bg-slate-200 ring-2 ring-slate-400" : "bg-slate-50 hover:bg-slate-100"}`}>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{on2}</p>
            <p className="text-[9px] text-slate-500">2 objets</p>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => switchFilter("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${filter === "all" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            Toutes ({properties.length})
          </button>
          <button type="button" onClick={() => switchFilter("hubspot")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${filter === "hubspot" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            HubSpot ({hubspotCount})
          </button>
          <button type="button" onClick={() => switchFilter("custom")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${filter === "custom" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            Custom ({customCount})
          </button>
        </div>
      </div>

      {/* Sort + pagination info */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setSortDir(sortDir === "desc" ? "asc" : "desc"); setPage(0); }}
          className="flex items-center gap-1 rounded-md border border-card-border px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {sortDir === "desc" ? "▼" : "▲"} Enrichissement {sortDir === "desc" ? "haut → bas" : "bas → haut"}
        </button>
        <p className="text-[10px] text-slate-400">
          {filtered.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur ${filtered.length}` : "0 résultats"}
        </p>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">Aucune propriété dans ce filtre.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => {
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
                      <span className={`shrink-0 rounded px-1 py-px text-[8px] font-bold ${p.isCustom ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                        {p.isCustom ? "CUSTOM" : "HUBSPOT"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-400">{p.name} · {p.type}{!p.sameLabel && " · labels différents"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.objects.map((obj) => (
                      <span key={obj} className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${OBJ_COLORS[obj] ?? "bg-slate-100 text-slate-600"}`}>
                        {OBJ_LABELS[obj] ?? obj}
                      </span>
                    ))}
                  </div>
                </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-30">
            ←
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
              <button key={i} type="button" onClick={() => setPage(i)}
                className={`h-1.5 w-1.5 rounded-full transition ${i === page ? "bg-accent" : "bg-slate-300 hover:bg-slate-400"}`} />
            ))}
          </div>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-30">
            →
          </button>
        </div>
      )}
    </div>
  );
}
