"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { addSavedReport } from "./saved-reports";
import type { ReportSpec, ChartProposal, ProposedAction } from "@/lib/ai/agents/agent-runtime";

/**
 * Artefacts attachés à un message d'agent : rapport, proposition de graphique,
 * et suggestion d'alerte confirmable. Persistent dans le message (donc dans
 * l'historique) et ne disparaissent plus au message suivant.
 */
export function MessageArtifacts({
  agentKey,
  agentLabel,
  report,
  chart,
  action,
}: {
  agentKey: string;
  agentLabel: string;
  report?: ReportSpec | null;
  chart?: ChartProposal | null;
  action?: ProposedAction | null;
}) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const hasReport = !!(report || chart);
  const reportTitle = report?.title || chart?.title || "ce rapport";
  // Bloc TOUJOURS présent sous un rapport : l'alerte proposée par l'agent, ou une par défaut.
  const effectiveAction: ProposedAction | null =
    action ??
    (hasReport
      ? {
          action_type: "create_alert",
          title: `Suivi : ${reportTitle}`.slice(0, 120),
          description: `Être alerté sur l'évolution de : ${reportTitle}.`,
          category: "revops",
        }
      : null);

  async function confirm() {
    if (!effectiveAction) return;
    setState("saving");
    try {
      const res = await fetch(`/api/agents/${agentKey}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: effectiveAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      // Enregistre le rapport + l'alerte (visible sur /dashboard/mes-rapports)
      if (report || chart) {
        addSavedReport({
          agentKey,
          agentLabel,
          title: report?.title || chart?.title || effectiveAction.title,
          summary: report?.summary || chart?.summary,
          report: report ?? null,
          chart: chart ?? null,
          alert: {
            title: effectiveAction.title,
            description: effectiveAction.description,
            impact: effectiveAction.impact,
            category: effectiveAction.category,
          },
          alertId: data.id,
        });
      }
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (!report && !chart && !effectiveAction) return null;

  return (
    <div className="ml-9 space-y-2">
      {report && <AgentReport spec={report} />}
      {chart && <ChartPicker proposal={chart} />}

      {effectiveAction && (
        <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
            <span>✨</span> Suggestion Revold · enregistrer + alerte de suivi
          </div>
          <div className="text-sm font-semibold text-slate-800">{effectiveAction.title}</div>
          <p className="mt-0.5 text-sm text-slate-600">{effectiveAction.description}</p>
          {effectiveAction.impact && <p className="mt-1 text-xs text-slate-500">Impact : {effectiveAction.impact}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state === "done" ? (
              <span className="text-sm font-medium text-emerald-600">
                ✓ Alerte activée{hasReport ? " · rapport enregistré" : ""} —{" "}
                <Link href="/dashboard/mes-rapports" className="underline hover:text-emerald-700">
                  voir mes rapports
                </Link>
              </span>
            ) : (
              <button
                onClick={confirm}
                disabled={state === "saving"}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {state === "saving"
                  ? "Enregistrement…"
                  : hasReport
                    ? "Activer l'alerte et enregistrer le rapport"
                    : "Activer l'alerte"}
              </button>
            )}
            {state === "error" && <span className="text-xs text-red-500">Échec.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
