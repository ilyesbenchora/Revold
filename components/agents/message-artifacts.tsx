"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { addSavedReport } from "./saved-reports";
import type { ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

/**
 * Artefacts attachés à un message d'agent dans le FIL de discussion : rapport et
 * proposition de graphique, plus un bouton discret « Enregistrer le rapport ».
 *
 * La suggestion d'alerte n'apparaît PAS ici (elle serait intrusive et casserait
 * le flux) : elle est reléguée dans l'onglet « Alertes » du chat via
 * AlertSuggestionCard. Voir paiement-agent-chat.tsx.
 */
export function MessageArtifacts({
  agentKey,
  agentLabel,
  report,
  chart,
}: {
  agentKey: string;
  agentLabel: string;
  report?: ReportSpec | null;
  chart?: ChartProposal | null;
}) {
  const [saved, setSaved] = useState(false);

  const hasReport = !!(report || chart);

  // Enregistrement direct du rapport (sans alerte) — alimente les pages de
  // projection (Prévisions) et « Mes rapports ».
  function saveReportOnly() {
    if (!hasReport || saved) return;
    addSavedReport({
      agentKey,
      agentLabel,
      title: report?.title || chart?.title || "Projection",
      summary: report?.summary || chart?.summary,
      report: report ?? null,
      chart: chart ?? null,
      alert: {
        title: report?.title || chart?.title || "Projection",
        description: report?.summary || chart?.summary || "Projection enregistrée depuis le chat.",
        category: "revops",
        channels: [],
      },
    });
    setSaved(true);
  }

  if (!hasReport) return null;

  return (
    <div className="ml-9 space-y-2">
      {report && <AgentReport spec={report} />}
      {chart && <ChartPicker proposal={chart} />}

      {/* Enregistrer le rapport (indépendant de l'alerte) */}
      <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-indigo-100 bg-indigo-50/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          <span>💾</span> Enregistrer le rapport
        </div>
        <div className="flex items-center justify-between gap-3 p-3.5">
          <p className="text-xs text-slate-500">
            Sauvegarde ce rapport dans <strong className="text-slate-700">Mes rapports</strong> — sans créer d&apos;alerte.
          </p>
          {saved ? (
            <Link
              href="/dashboard/mes-rapports"
              className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              ✓ Enregistré — voir
            </Link>
          ) : (
            <button
              onClick={saveReportOnly}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Enregistrer le rapport
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
