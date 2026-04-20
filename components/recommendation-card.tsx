"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recommendation } from "@/lib/audit/recommendations-library";
import { SEVERITY_LABELS, EFFORT_LABELS, SUBCATEGORY_LABELS } from "@/lib/audit/recommendations-library";

type Props = {
  reco: Recommendation;
};

export function RecommendationCard({ reco }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const severity = SEVERITY_LABELS[reco.severity];

  async function activateCoaching() {
    setState("loading");
    try {
      const actionSummary = reco.actionPlan
        .map((a) => `${a.step}. ${a.action} (${a.timeframe}, effort ${a.effort})`)
        .join("\n");
      const res = await fetch("/api/recommendations/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoId: reco.id,
          title: reco.title,
          painPoint: reco.painPoint,
          currentState: reco.currentState,
          impact: reco.impact,
          actionPlan: actionSummary,
          severity: reco.severity,
          coachingCategory: reco.coachingCategory,
        }),
      });
      if (res.ok) {
        setState("done");
        router.refresh();
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-xl">
      {/* Bandeau gradient haut */}
      <div className={`h-1.5 bg-gradient-to-r ${reco.color}`} />

      {/* Halo coloré décoratif */}
      <div
        className={`pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br ${reco.color} opacity-10 blur-2xl transition group-hover:opacity-20`}
      />

      <div className="relative p-6 space-y-5">
        {/* Header : severity + subcategory */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severity.bg} ${severity.text}`}>
            {severity.label}
          </span>
          {reco.subcategory && (
            <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${SUBCATEGORY_LABELS[reco.subcategory].gradient} px-2.5 py-0.5 text-[10px] font-bold text-white`}>
              <span aria-hidden>{SUBCATEGORY_LABELS[reco.subcategory].emoji}</span>
              {SUBCATEGORY_LABELS[reco.subcategory].label}
            </span>
          )}
        </div>

        {/* Titre principal */}
        <h3 className="text-lg font-bold leading-tight text-slate-900">{reco.title}</h3>

        {/* Pain point — le diagnostic */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            🎯 Pain point identifié
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{reco.painPoint}</p>
        </div>

        {/* État actuel avec les chiffres */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
            📊 État actuel
          </p>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{reco.currentState}</p>
        </div>

        {/* Impact business */}
        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${reco.color} p-4 shadow-sm`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
            ⚠ Impact business si non adressé
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-white">{reco.impact}</p>
        </div>

        {/* Plan d'action */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            🛠 Plan d&apos;action ({reco.actionPlan.length} étapes)
          </p>
          <ol className="space-y-2">
            {reco.actionPlan.map((step) => (
              <li key={step.step} className="flex gap-3 rounded-lg border border-slate-100 bg-white p-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">
                  {step.step}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">{step.action}</p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500">⏱ {step.timeframe}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${EFFORT_LABELS[step.effort].bg}`}>
                      {EFFORT_LABELS[step.effort].label}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* CTA Activer coaching */}
        <div className="pt-2">
          {state === "done" ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
              Coaching activé — retrouvez-le dans Coaching IA
            </div>
          ) : (
            <button
              type="button"
              onClick={activateCoaching}
              disabled={state === "loading"}
              className={`w-full rounded-xl bg-gradient-to-r ${reco.color} px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-50`}
            >
              {state === "loading" ? "Activation..." : "🧠 Activer le coaching IA"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
