"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCohortOptions, fetchCohortValues, type CohortOption, type ActiveCohort } from "@/lib/reports/cohort-filter-client";
import { AgentReport } from "./agent-report";
import { ChartPicker } from "./chart-picker";
import { ChartWiringPanel } from "./chart-wiring-panel";
import { ReportPeriodBar, type AppliedPeriod } from "./report-period-bar";
import { addSavedReport, updateSavedReport, reportKey, isReportSaved, markReportSaved } from "./saved-reports";
import { AlertSuggestionCard } from "./alert-suggestion-card";
import { type ToolOption } from "./alert-cross-tools";
import { DrilldownModal, type DrilldownTarget } from "@/components/reports/drilldown-modal";
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
  savedReportId,
}: {
  agentKey: string;
  agentLabel: string;
  report?: ReportSpec | null;
  chart?: ChartProposal | null;
  sources?: string[];
  showSave?: boolean;
  /**
   * Rapport DÉJÀ enregistré : toute correction du câblage (regroupement,
   * mesure) est persistée sur la ligne saved_reports — le rapport rouvert
   * plus tard affiche les vrais chiffres re-vérifiés, pas l'ancien câblage.
   */
  savedReportId?: string;
}) {
  const [curReport, setCurReport] = useState<ReportSpec | null>(report ?? null);
  const [curChart, setCurChart] = useState<ChartProposal | null>(chart ?? null);
  const [chartType, setChartType] = useState<string>(chart?.defaultType || chart?.suggestedTypes?.[0] || "bar");
  // État « enregistré » persistant : au retour dans la conversation, le CTA
  // reflète le fait que le rapport a déjà été enregistré.
  const initialData = chart?.data ?? report?.blocks.find((b) => Array.isArray(b.data) && b.data?.length)?.data ?? [];
  const [saved, setSaved] = useState(() =>
    isReportSaved(reportKey(agentKey, report?.title || chart?.title || "", initialData)),
  );
  const [period, setPeriod] = useState<AppliedPeriod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ── Cohortes (Paramètres → Cohortes) : filtre au même titre que la période,
  // recalcul déterministe à la source — uniquement quand le rapport est câblé.
  const [cohortOptions, setCohortOptions] = useState<CohortOption[]>([]);
  const [cohortKey, setCohortKey] = useState<string | null>(null);
  const [cohortValue, setCohortValue] = useState<string | null>(null);
  const [cohortVals, setCohortVals] = useState<string[]>([]);
  const activeCohort: ActiveCohort | null = cohortKey && cohortValue ? { key: cohortKey, value: cohortValue } : null;
  // Alerte de suivi créée depuis le rapport (tracking interactif).
  const [showAlert, setShowAlert] = useState(false);
  // Drill-down : clic sur un chiffre → détail des enregistrements du bucket
  // (uniquement quand le bloc/graphique porte sa requête déterministe).
  const [drill, setDrill] = useState<DrilldownTarget | null>(null);
  const drillPeriod = period ? { from: period.from, to: period.to, all: period.preset === "all" } : { all: true };
  const [tools, setTools] = useState<ToolOption[]>([]);
  const [toolsLoaded, setToolsLoaded] = useState(false);

  const hasReport = !!(curReport || curChart);

  // Rapport DÉTERMINISTE (câblé) : période ET cohorte recalculées à la source.
  const detBlocks = curReport?.blocks.filter((b) => b.type === "kpi" || (Array.isArray(b.data) && b.data?.length)) ?? [];
  const reportDeterministic = detBlocks.length > 0 && detBlocks.every((b) => !!b.query);
  const deterministic = !!curChart?.query || reportDeterministic;

  useEffect(() => {
    if (deterministic) void fetchCohortOptions().then(setCohortOptions);
  }, [deterministic]);

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

  /**
   * Recalcul DÉTERMINISTE (période + cohorte) : ré-exécute chaque requête
   * câblée à la source avec les bornes de dates ET la cohorte active.
   * Renvoie true si le rapport a été recalculé par ce chemin.
   */
  async function recomputeDeterministic(p: AppliedPeriod | null, co: ActiveCohort | null): Promise<boolean> {
    const all = !p || p.preset === "all";
    if (curChart?.query) {
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { ...curChart.query, cohort: co },
          all,
          date_from: p?.from,
          date_to: p?.to,
          sources,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du recalcul");
      setCurChart({ ...curChart, data: data.data });
      setSaved(false);
      return true;
    }
    if (curReport && curReport.blocks.some((b) => b.query)) {
      const updated = await Promise.all(
        curReport.blocks.map(async (b) => {
          if (!b.query) return b;
          const res = await fetch("/api/reports/recompute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: { ...b.query, cohort: co }, all, date_from: p?.from, date_to: p?.to, sources }),
          });
          if (!res.ok) return b; // on garde l'ancien bloc si échec
          const d = await res.json();
          const pts = (d.data ?? []) as { name: string; value: number }[];
          if (b.type === "kpi") {
            const total = pts.reduce((s, x) => s + (x.value || 0), 0);
            return { ...b, value: Math.round(total).toLocaleString("fr-FR") };
          }
          return { ...b, data: pts };
        }),
      );
      setCurReport({ ...curReport, blocks: updated });
      setSaved(false);
      return true;
    }
    return false;
  }

  /** Changement de cohorte : recalcul immédiat avec la période courante. */
  async function applyCohort(co: ActiveCohort | null) {
    setLoading(true);
    setError(null);
    try {
      await recomputeDeterministic(period, co);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de recalcul");
    } finally {
      setLoading(false);
    }
  }

  async function applyPeriod(p: AppliedPeriod) {
    setLoading(true);
    setError(null);
    try {
      // ── Chemin DÉTERMINISTE (100 % fiable) : les requêtes câblées sont
      // ré-exécutées à la source (aucune IA), cohorte active conservée.
      if (await recomputeDeterministic(p, activeCohort)) {
        setPeriod(p);
        return;
      }

      // ── Fallback (rapport figé / graphique sans requête) : régénération agent,
      // best-effort (non garanti 100 %). Signalé à l'utilisateur.
      const res = await fetch(`/api/agents/${agentKey}/report-period`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: curChart ? "chart" : "report",
          title: curReport?.title || curChart?.title || "Rapport",
          summary: curReport?.summary || curChart?.summary || "",
          dimensions: currentDimensions(),
          all: p.preset === "all",
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
    // Le titre porte les filtres appliqués (période, cohorte) : les données
    // enregistrées sont celles recalculées avec ces filtres.
    const cohortSuffix = activeCohort
      ? ` — ${cohortOptions.find((o) => o.id === activeCohort.key)?.label ?? activeCohort.key} : ${activeCohort.value}`
      : "";
    const title = `${period ? `${baseTitle} — ${period.label}` : baseTitle}${cohortSuffix}`;
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
    markReportSaved(reportKey(agentKey, curReport?.title || curChart?.title || "", currentData()));
    setSaved(true);
  }

  if (!hasReport) return null;

  return (
    <div className="space-y-2">
      <ReportPeriodBar onApply={applyPeriod} loading={loading} activeLabel={period?.label ?? null} applied={period} />

      {/* ── Cohorte (Paramètres → Cohortes) : filtre recalculé à la source,
             au même titre que la période — rapports câblés uniquement. ── */}
      {deterministic && cohortOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">Cohorte :</span>
          <select
            value={cohortKey ?? ""}
            disabled={loading}
            onChange={(e) => {
              const k = e.target.value || null;
              setCohortKey(k);
              setCohortValue(null);
              setCohortVals([]);
              if (k) void fetchCohortValues(k).then(setCohortVals);
              else void applyCohort(null);
            }}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none transition focus:border-accent"
          >
            <option value="">Toutes</option>
            {cohortOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {cohortKey && (
            <select
              value={cohortValue ?? ""}
              disabled={loading}
              onChange={(e) => {
                const v = e.target.value || null;
                setCohortValue(v);
                void applyCohort(v && cohortKey ? { key: cohortKey, value: v } : null);
              }}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none transition focus:border-accent"
            >
              <option value="">Choisir une valeur…</option>
              {cohortVals.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}
          {activeCohort && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setCohortKey(null);
                setCohortValue(null);
                setCohortVals([]);
                void applyCohort(null);
              }}
              className="rounded-md px-1.5 py-1 text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕ Retirer
            </button>
          )}
        </div>
      )}

      {deterministic ? (
        <p className="text-[10px] text-emerald-600">✓ Recalcul exact par période et cohorte (chiffres recalculés à la source).</p>
      ) : (
        <p className="text-[10px] text-amber-600">
          ⚠ Recalcul de période <strong>approximatif</strong> pour ce rapport (régénéré par l&apos;agent, non garanti
          100 %). Pour un recalcul exact, demande un graphique à l&apos;agent.
        </p>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">⚠ {error}</div>}

      {curReport && (
        <AgentReport
          spec={curReport}
          onBlockBucketClick={(b, bucket) =>
            b.query &&
            setDrill({ query: b.query, sources, period: drillPeriod, bucket, title: curReport.title })
          }
          onSpecChange={(next) => {
            setCurReport(next);
            // Rapport déjà enregistré : l'édition du tableau est persistée.
            if (savedReportId) updateSavedReport(savedReportId, { report: next });
            else setSaved(false);
          }}
        />
      )}
      {curChart && (
        <ChartPicker
          proposal={curChart}
          onTypeChange={setChartType}
          onBucketClick={
            curChart.query
              ? (bucket) => setDrill({ query: curChart.query!, sources, period: drillPeriod, bucket, title: curChart.title })
              : undefined
          }
        />
      )}

      {/* Modal de détail (drill-down) */}
      <DrilldownModal target={drill} onClose={() => setDrill(null)} />

      {/* ── Vérification du câblage — même exigence que les tables de données :
             l'utilisateur voit sur quelle donnée réelle l'agent s'est branché
             (source · regroupement · mesure) et peut la corriger, avec recalcul
             déterministe immédiat de la visualisation. ── */}
      {curChart?.query && (
        <ChartWiringPanel
          query={curChart.query}
          sources={sources}
          period={period ? { from: period.from, to: period.to, all: period.preset === "all" } : null}
          onApply={(nq, data) => {
            setCurChart((prev) => {
              const next = prev ? { ...prev, query: nq, data } : prev;
              // Rapport déjà enregistré : le câblage corrigé est persisté.
              if (savedReportId && next) updateSavedReport(savedReportId, { chart: next });
              return next;
            });
            setSaved(false);
          }}
        />
      )}
      {curReport?.blocks.some((b) => b.query) && (
        <div className="space-y-1.5">
          {curReport.blocks.map((b, i) =>
            b.query ? (
              <ChartWiringPanel
                key={`wiring-${i}`}
                label={b.title || b.label || (b.type === "kpi" ? `KPI ${i + 1}` : `Bloc ${i + 1}`)}
                query={b.query}
                sources={sources}
                period={period ? { from: period.from, to: period.to, all: period.preset === "all" } : null}
                onApply={(nq, data) => {
                  setCurReport((prev) => {
                    if (!prev) return prev;
                    const blocks = prev.blocks.map((x, j) => {
                      if (j !== i) return x;
                      if (x.type === "kpi") {
                        const t = data.reduce((s, r) => s + (Number(r.value) || 0), 0);
                        return { ...x, query: nq, value: Math.round(t).toLocaleString("fr-FR") };
                      }
                      return { ...x, query: nq, data };
                    });
                    const next = { ...prev, blocks };
                    // Rapport déjà enregistré : le câblage corrigé est persisté.
                    if (savedReportId) updateSavedReport(savedReportId, { report: next });
                    return next;
                  });
                  setSaved(false);
                }}
              />
            ) : null,
          )}
        </div>
      )}

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
        saved ? (
          // Réduit : le rapport a déjà été enregistré (état persistant).
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-700">
            <span>✓</span> Rapport enregistré —{" "}
            <Link href="/dashboard/mes-rapports" className="underline hover:text-emerald-800">
              voir mes rapports
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-indigo-100 bg-indigo-50/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
              <span>💾</span> Enregistrer le rapport
            </div>
            <div className="flex items-center justify-between gap-3 p-3.5">
              <p className="text-xs text-slate-500">
                Sauvegarde ce rapport dans <strong className="text-slate-700">Mes rapports</strong> — format et période
                choisis conservés.
              </p>
              <button
                onClick={saveReportOnly}
                disabled={loading}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                Enregistrer le rapport
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
