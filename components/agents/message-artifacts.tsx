"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { addSavedReport } from "./saved-reports";
import { ALERT_CHANNELS, SectionLabel } from "./alert-ui";
import type { ReportSpec, ChartProposal, ProposedAction } from "@/lib/ai/agents/agent-runtime";

/**
 * Artefacts attachés à un message d'agent : rapport, proposition de graphique,
 * et suggestion d'alerte confirmable (avec choix des canaux de notification).
 * Persistent dans le message (donc dans l'historique).
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
  const [channels, setChannels] = useState<string[]>(["app"]);

  const hasReport = !!(report || chart);
  const reportTitle = report?.title || chart?.title || "ce rapport";
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

  function toggleChannel(key: string) {
    setChannels((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function confirm() {
    if (!effectiveAction) return;
    setState("saving");
    const chosen = channels.length ? channels : ["app"];
    if (hasReport) {
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
          channels: chosen,
        },
      });
    }
    try {
      const res = await fetch(`/api/agents/${agentKey}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: effectiveAction, channels: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setState("done");
    } catch {
      setState(hasReport ? "done" : "error");
    }
  }

  if (!report && !chart && !effectiveAction) return null;
  const done = state === "done";

  return (
    <div className="ml-9 space-y-2">
      {report && <AgentReport spec={report} />}
      {chart && <ChartPicker proposal={chart} />}

      {effectiveAction && (
        <div className="overflow-hidden rounded-xl border border-fuchsia-200 bg-white shadow-sm">
          {/* En-tête */}
          <div className="flex items-center gap-1.5 border-b border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-indigo-50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
            <span>✨</span> Suggestion Revold · alerte de suivi
          </div>

          <div className="space-y-3 p-3.5">
            <div>
              <SectionLabel>Objectif</SectionLabel>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{effectiveAction.title}</div>
            </div>
            <div>
              <SectionLabel>Description</SectionLabel>
              <p className="mt-0.5 text-sm text-slate-600">{effectiveAction.description}</p>
            </div>
            {effectiveAction.impact && (
              <div>
                <SectionLabel>Impact attendu</SectionLabel>
                <p className="mt-0.5 text-sm text-slate-600">{effectiveAction.impact}</p>
              </div>
            )}

            <div>
              <SectionLabel>Recevoir l&apos;alerte via</SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ALERT_CHANNELS.map((c) => {
                  const on = channels.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      onClick={() => toggleChannel(c.key)}
                      disabled={done || state === "saving"}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-70 ${
                        on
                          ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-sm">{c.icon}</span>
                      {c.label}
                      {on && <span className="text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {done ? (
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
                  className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {state === "saving"
                    ? "Enregistrement…"
                    : hasReport
                      ? "Activer l'alerte et enregistrer le rapport"
                      : "Activer l'alerte"}
                </button>
              )}
              {state === "error" && <span className="text-xs text-red-500">Échec de la création.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
