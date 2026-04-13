"use client";

import { useState } from "react";

type PropertyUsage = {
  name: string;
  label: string;
  isCustom: boolean;
  deps: { workflows: number; forms: number; lists: number };
  totalDeps: number;
};

type Props = {
  properties: PropertyUsage[];
};

export function PropertyUsageBlock({ properties }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<"most" | "least">("most");

  const sorted = sort === "most"
    ? [...properties].sort((a, b) => b.totalDeps - a.totalDeps)
    : [...properties].sort((a, b) => a.totalDeps - b.totalDeps);

  const visible = showAll ? sorted : sorted.slice(0, 15);
  const maxDeps = Math.max(...properties.map((p) => p.totalDeps), 1);

  const withDeps = properties.filter((p) => p.totalDeps > 0).length;
  const withoutDeps = properties.filter((p) => p.totalDeps === 0).length;
  const totalWorkflows = properties.reduce((s, p) => s + p.deps.workflows, 0);
  const totalForms = properties.reduce((s, p) => s + p.deps.forms, 0);
  const totalLists = properties.reduce((s, p) => s + p.deps.lists, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-lg font-bold text-slate-900 tabular-nums">{withDeps}</p>
          <p className="text-[10px] text-slate-500">Avec dépendances</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-lg font-bold text-slate-400 tabular-nums">{withoutDeps}</p>
          <p className="text-[10px] text-slate-500">Sans dépendance</p>
        </div>
        <div className="rounded-lg bg-indigo-50 p-3 text-center">
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{totalWorkflows}</p>
          <p className="text-[10px] text-indigo-500">Liens workflows</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 text-center">
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{totalForms}</p>
          <p className="text-[10px] text-emerald-500">Liens formulaires</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-center">
          <p className="text-lg font-bold text-amber-600 tabular-nums">{totalLists}</p>
          <p className="text-[10px] text-amber-500">Liens segments</p>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSort("most")}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
            sort === "most" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Plus de dépendances
        </button>
        <button
          type="button"
          onClick={() => setSort("least")}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
            sort === "least" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Moins de dépendances
        </button>
      </div>

      {/* Property list */}
      <div className="space-y-1.5">
        {visible.map((prop) => (
          <div key={prop.name} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-700 truncate">{prop.label}</span>
                <span className={`shrink-0 rounded px-1 py-px text-[8px] font-bold ${
                  prop.isCustom ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {prop.isCustom ? "CUSTOM" : "HUBSPOT"}
                </span>
              </div>
              {/* Deps bar */}
              <div className="mt-1.5 flex items-center gap-1 h-1.5">
                {prop.deps.workflows > 0 && (
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(prop.deps.workflows / maxDeps) * 100}%`, minWidth: "4px" }}
                    title={`${prop.deps.workflows} workflow(s)`}
                  />
                )}
                {prop.deps.forms > 0 && (
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(prop.deps.forms / maxDeps) * 100}%`, minWidth: "4px" }}
                    title={`${prop.deps.forms} formulaire(s)`}
                  />
                )}
                {prop.deps.lists > 0 && (
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(prop.deps.lists / maxDeps) * 100}%`, minWidth: "4px" }}
                    title={`${prop.deps.lists} segment(s)`}
                  />
                )}
                {prop.totalDeps === 0 && (
                  <div className="h-full w-full rounded-full bg-slate-200" />
                )}
              </div>
            </div>
            {/* Dep badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {prop.deps.workflows > 0 && (
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 tabular-nums">
                  {prop.deps.workflows} WF
                </span>
              )}
              {prop.deps.forms > 0 && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 tabular-nums">
                  {prop.deps.forms} Form
                </span>
              )}
              {prop.deps.lists > 0 && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 tabular-nums">
                  {prop.deps.lists} Seg
                </span>
              )}
              {prop.totalDeps === 0 && (
                <span className="text-[9px] text-slate-400">Aucun</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show more */}
      {properties.length > 15 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full rounded-lg border border-card-border py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {showAll ? "Voir moins" : `Voir les ${properties.length} propriétés`}
        </button>
      )}
    </div>
  );
}
