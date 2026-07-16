"use client";

import { ReportArtifact } from "./report-artifact";
import type { ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

/**
 * Artefacts d'un message d'agent dans le fil : rapport/graphique avec choix du
 * format, ventilation temporelle fiable et bouton d'enregistrement. Fin wrapper
 * autour de ReportArtifact (variant chat). L'alerte reste dans l'onglet Alertes.
 */
export function MessageArtifacts({
  agentKey,
  agentLabel,
  report,
  chart,
  sources = [],
}: {
  agentKey: string;
  agentLabel: string;
  report?: ReportSpec | null;
  chart?: ChartProposal | null;
  sources?: string[];
}) {
  if (!report && !chart) return null;
  return (
    <div className="ml-9">
      <ReportArtifact agentKey={agentKey} agentLabel={agentLabel} report={report} chart={chart} sources={sources} showSave />
    </div>
  );
}
