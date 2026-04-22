"use client";

import { useState } from "react";
import type { WorkflowDetail } from "@/lib/integrations/hubspot-workflows";

const SEV_STYLE: Record<"critical" | "warning" | "info", { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  warning: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  info: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

const ACTION_COLOR: Record<string, string> = {
  set_property: "bg-indigo-100 text-indigo-700",
  send_email: "bg-blue-100 text-blue-700",
  create_task: "bg-amber-100 text-amber-800",
  webhook: "bg-fuchsia-100 text-fuchsia-700",
  branch: "bg-violet-100 text-violet-700",
  delay: "bg-slate-100 text-slate-600",
  create_engagement: "bg-emerald-100 text-emerald-700",
  update_owner: "bg-orange-100 text-orange-700",
  other: "bg-slate-100 text-slate-600",
};

const OBJECT_LABEL: Record<string, string> = {
  contact: "Contact", company: "Entreprise", deal: "Transaction",
  ticket: "Ticket", lead: "Lead", custom: "Custom Object", unknown: "Inconnu",
};

export function WorkflowCarousel({ details }: { details: WorkflowDetail[] }) {
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<"all" | "with_recos" | "critical">("all");

  const filtered = details.filter((d) => {
    if (filter === "with_recos") return d.recommendations.length > 0;
    if (filter === "critical") return d.recommendations.some((r) => r.severity === "critical");
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-500">
          {filter === "all"
            ? "Aucun workflow actif détaillé."
            : "Aucun workflow ne match ce filtre."}
        </p>
      </div>
    );
  }

  const safeIndex = Math.min(index, filtered.length - 1);
  const w = filtered[safeIndex];

  return (
    <div className="space-y-4">
      {/* Filtre + navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-1 text-xs">
          <span className="mr-2 font-semibold text-slate-700">Filtrer :</span>
          {([
            ["all", "Tous"],
            ["with_recos", "Avec recos"],
            ["critical", "Critiques"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setFilter(key); setIndex(0); }}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filter === key ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            className="rounded-md bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-slate-500">
            <span className="font-bold text-slate-900">{safeIndex + 1}</span> / {filtered.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
            disabled={safeIndex === filtered.length - 1}
            className="rounded-md bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      </div>

      {/* Card workflow détaillée */}
      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  {OBJECT_LABEL[w.objectType] ?? w.objectType}
                </span>
                {w.isMultiPurpose && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    ⚠ Multi-purpose
                  </span>
                )}
                {w.reenrollmentEnabled ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    ✓ Re-enrollment ON
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    ⚠ Re-enrollment OFF
                  </span>
                )}
                {w.hasGoal ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    🎯 Goal défini
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    🎯 Goal manquant
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-base font-bold text-slate-900">{w.name}</h3>
            </div>
          </div>

          {/* Trigger */}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Déclencheur</p>
            <p className="mt-1 text-sm text-slate-800">{w.triggerDescription}</p>
            {w.triggerCriteriaCount === 0 && (
              <p className="mt-1 text-[11px] text-amber-700">⚠ Sans filter — risque d&apos;enrollment massif</p>
            )}
          </div>

          {/* Goal si présent */}
          {w.goalDescription && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">🎯 Objectif (sortie auto)</p>
              <p className="mt-1 text-sm text-emerald-900">{w.goalDescription}</p>
            </div>
          )}

          {/* Actions séquence */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Séquence d&apos;actions ({w.actions.length})
            </p>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <ol className="divide-y divide-slate-100">
                {w.actions.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${ACTION_COLOR[a.category] ?? ACTION_COLOR.other}`}>
                      {a.category}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-xs text-slate-700">{a.description}</p>
                  </li>
                ))}
                {w.actions.length === 0 && (
                  <li className="px-3 py-3 text-xs text-slate-400">Aucune action listée par l&apos;API.</li>
                )}
              </ol>
            </div>
          </div>

          {/* Recommandations CRO */}
          {w.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">
                ✨ {w.recommendations.length} recommandation{w.recommendations.length > 1 ? "s" : ""} CRO/RevOps
              </p>
              {w.recommendations.map((r, i) => {
                const sev = SEV_STYLE[r.severity];
                return (
                  <div key={i} className={`rounded-lg border ${sev.border} ${sev.bg} p-3`}>
                    <p className={`text-xs font-bold ${sev.text}`}>{r.title}</p>
                    <p className="mt-1 text-[11px] text-slate-700">{r.body}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-slate-900">
                      → {r.recommendation}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
