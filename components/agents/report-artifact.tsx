"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { ReportPeriodBar, type AppliedPeriod } from "./report-period-bar";
import { addSavedReport } from "./saved-reports";
import { AlertSuggestionCard } from "./alert-suggestion-card";
import { type ToolOption } from "./alert-cross-tools";
import type { ReportSpec, ChartProposal, ProposedAction } from "@/lib/ai/agents/agent-runtime";

/**
 * Affichage d'un rapport/graphique avec :
 *  - choix du format par l'utilisateur (ChartPicker),
 *  - VENTILATION TEMPORELLE (presets type HubSpot + dates perso) qui RECALCULE
 *    les vrais chiffres côté serveur (fiabilité — aucun découpage client),
 *  - option d'enregistrement (variant chat) conservant format + période.
 *
 * Réutilisé partout : chat, Mes rapports, Mes prévisions, carrousels.
 */
export function ReportArtifact({
  agentKey,
  agentLabel,
  report,
  chart,
  sources = [],
  showSave = false,
}: {
  agentKey: string;
  agentLabel: string;
  report?: ReportSpec | null;
  chart?: ChartProposal | null;
  sources?: string[];
  showSave?: boolean;
}) {
  const [curReport, setCurReport] = useState<ReportSpec | null>(report ?? null);
  const [curChart, setCurChart] = useState<ChartProposal | null>(chart ?? null);
  const [chartType, setChartType] = useState<string>(chart?.defaultType || chart?.suggestedTypes?.[0] || "bar");
  const [saved, setSaved] = useState(false);
  const [period, setPeriod] = useState<AppliedPeriod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Alerte de suivi créée depuis le rapport (tracking interactif).
  const [showAlert, setShowAlert] = useState(false);
  const [tools, setTools] = useState<ToolOption[]>([]);
  const [toolsLoaded, setToolsLoaded] = useState(false);

  const hasReport = !!(curReport || curChart);

  function currentData(): { name: string; value: number }[] {
    if (curChart) return curChart.data;
    const block = curReport?.blocks.find((b) => Array.isArray(b.data) && b.data.length);
    return block?.data ?? [];
  }
  function currentDimensions(): string[] {
    return currentData().map((d) => d.name);
  }
  function currentTotal(): number {
    return currentData().reduce((s, d) => s + (typeof d.value === "number" ? d.value : 0), 0);
  }

  async function openAlert() {
    setShowAlert(true);
    if (toolsLoaded) return;
    try {
      const r = await fetch("/api/integrations/connected");
      const d = await r.json();
      setTools(d.tools ?? []);
    } catch {
      /* pas d'outils → sélecteur vide */
    }
    setToolsLoaded(true);
  }

  async function applyPeriod(p: AppliedPeriod) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentKey}/report-period`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: curChart ? "chart" : "report",
          title: curReport?.title || curChart?.title || "Rapport",
          summary: curReport?.summary || curChart?.summary || "",
          dimensions: currentDimensions(),
          from: p.from,
          to: p.to,
          periodLabel: p.label,
          sources,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du recalcul");
      if (data.chartProposal) {
        setCurChart(data.chartProposal);
        setChartType(data.chartProposal.defaultType || data.chartProposal.suggestedTypes?.[0] || chartType);
        setCurReport(null);
      } else if (data.report) {
        setCurReport(data.report);
        setCurChart(null);
      } else {
        throw new Error("Aucune donnée renvoyée pour cette période");
      }
      setPeriod(p);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de recalcul");
    } finally {
      setLoading(false);
    }
  }

  function saveReportOnly() {
    if (!hasReport || saved) return;
    const baseTitle = curReport?.title || curChart?.title || "Projection";
    const title = period ? `${baseTitle} — ${period.label}` : baseTitle;
    addSavedReport({
      agentKey,
      agentLabel,
      title,
      summary: curReport?.summary || curChart?.summary,
      report: curReport ?? null,
      chart: curChart ? { ...curChart, defaultType: chartType } : null,
      alert: {
        title,
        description: curReport?.summary || curChart?.summary || "Rapport enregistré depuis le chat.",
        category: "revops",
        channels: [],
      },
    });
    setSaved(true);
  }

  if (!hasReport) return null;

  return (
    <div className="space-y-2">
      <ReportPeriodBar onApply={applyPeriod} loading={loading} activeLabel={period?.label ?? null} />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">⚠ {error}</div>}

      {curReport && <AgentReport spec={curReport} />}
      {curChart && <ChartPicker proposal={curChart} onTypeChange={setChartType} />}

      {/* Créer une alerte de suivi directement sur ce rapport (tracking interactif) */}
      {!showAlert ? (
        <button
          onClick={openAlert}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50/60 px-3 py-2 text-xs font-medium text-fuchsia-700 transition hover:bg-fuchsia-100"
        >
          <span>✨</span> Créer une alerte de suivi sur ce rapport
        </button>
      ) : (
        <AlertSuggestionCard
          agentKey={agentKey}
          action={{
            action_type: "create_alert",
            title: (curReport?.title || curChart?.title || "Suivi du rapport").slice(0, 120),
            description:
              curReport?.summary ||
              curChart?.summary ||
              `Suivi de « ${curReport?.title || curChart?.title || "ce rapport"} »`,
            category: "revops",
            impact: "",
          }}
          tools={tools}
          initialSources={sources}
          initialKpi={currentTotal() ? String(Math.round(currentTotal())) : ""}
          initialKpiFormat="currency"
          initialDateFrom={period?.from ?? ""}
          initialDateTo={period?.to ?? ""}
          baseline={`Valeur actuelle du rapport${period ? ` (${period.label})` : ""} : ${currentTotal().toLocaleString("fr-FR")}`}
        />
      )}

      {showSave && (
        <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-indigo-100 bg-indigo-50/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
            <span>💾</span> Enregistrer le rapport
          </div>
          <div className="flex items-center justify-between gap-3 p-3.5">
            <p className="text-xs text-slate-500">
              Sauvegarde ce rapport dans <strong className="text-slate-700">Mes rapports</strong> — format et période choisis
              conservés.
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
                disabled={loading}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                Enregistrer le rapport
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
