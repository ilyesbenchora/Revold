"use client";

import { useEffect, useRef, useState } from "react";
import {
  FREQUENCY_LABELS,
  ROUTINE_REPORT_DIRECTIVE,
  routineSuggestionsFor,
  RECAP_PERIODS,
  recapTopicsFor,
  buildRecapRoutine,
  type RecapPeriodKind,
  type RoutineFrequency,
} from "@/lib/ai/agents/routine-catalog";
import {
  addRoutine,
  listAgentRoutines,
  refreshRoutines,
  removeRoutine,
  updateRoutine,
  ROUTINES_UPDATED_EVENT,
  type Routine,
} from "./routines";
import { addSavedReport } from "./saved-reports";
import { ReportChart } from "./agent-report";
import { RecapPreviewEditor } from "./recap-preview-editor";
import type { ReportSpec, ChartProposal, ReportBlock } from "@/lib/ai/agents/agent-runtime";

const FREQUENCIES: RoutineFrequency[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

function fmtLastRun(ts?: number | null): string {
  if (!ts) return "jamais exécutée";
  return `dernier rapport le ${new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Routines de l'agent côté client : liste (serveur = source de vérité) et
 * exécution MANUELLE (« Exécuter maintenant »). L'exécution PROGRAMMÉE est
 * faite côté serveur par le cron /api/cron/run-routines — les rapports
 * arrivent dans « Rapports enregistrés » même si Revold est fermé.
 */
export function useAgentRoutines(agentKey: string, agentLabel: string, sourceKeys: string[]) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [runningIds, setRunningIds] = useState<string[]>([]);
  const runningRef = useRef<Set<string>>(new Set());
  const sourcesRef = useRef(sourceKeys);
  sourcesRef.current = sourceKeys;

  useEffect(() => {
    const refresh = () => setRoutines(listAgentRoutines(agentKey));
    refresh();
    window.addEventListener(ROUTINES_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ROUTINES_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [agentKey]);

  async function runRoutine(r: Routine) {
    if (runningRef.current.has(r.id)) return;
    runningRef.current.add(r.id);
    setRunningIds([...runningRef.current]);
    // L'occurrence est consommée immédiatement : pas de double exécution si la
    // page est rechargée pendant la génération. L'échec est signalé (lastError).
    updateRoutine(r.id, { lastRunAt: Date.now(), lastError: null });
    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: r.prompt + ROUTINE_REPORT_DIRECTIVE }],
          sources: sourcesRef.current,
          attachments: [],
        }),
      });
      // Réponse non-JSON (page d'erreur Vercel, timeout, HTML) → message clair
      // au lieu d'un « Unexpected token … is not valid JSON ».
      const raw = await res.text();
      let data: { error?: string; message?: string; report?: unknown; chartProposal?: unknown };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          res.ok
            ? "Réponse illisible du serveur"
            : `Le serveur n'a pas répondu à temps (erreur ${res.status}) — relance la routine`,
        );
      }
      if (!res.ok) throw new Error(data.error || "Erreur agent");
      const report = (data.report ?? null) as ReportSpec | null;
      const chart = (data.chartProposal ?? null) as ChartProposal | null;
      if (!report && !chart) throw new Error("L'agent n'a pas renvoyé de rapport visuel");
      const title = report?.title || chart?.title || r.label;
      addSavedReport({
        agentKey,
        agentLabel,
        title,
        summary: report?.summary || chart?.summary,
        report,
        chart,
        alert: {
          title,
          description: report?.summary || chart?.summary || `Rapport généré par la routine « ${r.label} ».`,
          category: "revops",
          channels: [],
        },
        origin: "routine",
        routineLabel: r.label,
        // Analyse écrite détaillée de l'agent : affichée en pleine largeur
        // sous le rapport visuel dans « Rapports enregistrés ».
        analysis: typeof data.message === "string" ? data.message : undefined,
      });
      // Pas de notification pour « Exécuter maintenant » : l'utilisateur est
      // devant le résultat. Les exécutions programmées (cron serveur) notifient.
    } catch (e) {
      updateRoutine(r.id, { lastError: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      runningRef.current.delete(r.id);
      setRunningIds([...runningRef.current]);
    }
  }

  // L'exécution PROGRAMMÉE tourne côté serveur (cron run-routines) : ici on
  // rafraîchit périodiquement la liste pour voir arriver last_run_at / erreurs.
  useEffect(() => {
    const iv = setInterval(() => refreshRoutines(), 120_000);
    return () => clearInterval(iv);
  }, [agentKey]);

  return { routines, runningIds, runRoutine };
}

/**
 * Onglet « Routines » du chat : habitudes de chat avec le coach — suggestions
 * prédéfinies adaptées au métier (ex : récap des ventes de la semaine tous les
 * jours à 9h00 pour le coach des ventes), routines actives modifiables, et
 * création d'une routine personnalisée.
 */
export function RoutinesTab({
  agentKey,
  agentLabel,
  routines,
  runningIds,
  onRunNow,
  sourceKeys = [],
}: {
  agentKey: string;
  agentLabel: string;
  routines: Routine[];
  runningIds: string[];
  onRunNow: (r: Routine) => void;
  /** Outils sources de l'agent — utilisés pour générer l'aperçu du récap. */
  sourceKeys?: string[];
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [customFreq, setCustomFreq] = useState<RoutineFrequency>("daily");

  // ── Constructeur de récap sur mesure : période + thèmes MACRO ──
  const [recapPeriod, setRecapPeriod] = useState<RecapPeriodKind>("week");
  const [recapFrom, setRecapFrom] = useState("");
  const [recapTo, setRecapTo] = useState("");
  const [recapTopicIds, setRecapTopicIds] = useState<string[]>([]);
  const [recapTime, setRecapTime] = useState("09:00");
  const recapTopics = recapTopicsFor(agentKey);
  const recapInvalid = recapPeriod === "custom" && (!recapFrom || !recapTo || recapFrom > recapTo);

  // Aperçu du récap AVANT enregistrement : l'agent génère le rapport une fois,
  // l'utilisateur peut demander des ajustements, puis enregistre la routine.
  const [recapPreview, setRecapPreview] = useState<{ report: ReportSpec | null; chart: ChartProposal | null; analysis: string | null } | null>(null);
  const [recapPreviewLoading, setRecapPreviewLoading] = useState(false);
  const [recapPreviewError, setRecapPreviewError] = useState<string | null>(null);
  const [refinement, setRefinement] = useState("");
  const [refinements, setRefinements] = useState<string[]>([]);

  function toggleRecapTopic(id: string) {
    setRecapTopicIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    // Le périmètre change : l'aperçu et les ajustements ne valent plus.
    setRecapPreview(null);
    setRefinements([]);
    setRecapPreviewError(null);
  }

  function pickRecapPeriod(id: RecapPeriodKind) {
    setRecapPeriod(id);
    setRecapPreview(null);
    setRefinements([]);
    setRecapPreviewError(null);
  }

  /** Prompt/label/fréquence du récap courant, ajustements inclus. */
  function currentRecap() {
    const built = buildRecapRoutine({
      agentKey,
      periodKind: recapPeriod,
      from: recapFrom || undefined,
      to: recapTo || undefined,
      topicIds: recapTopicIds,
    });
    const prompt = refinements.length
      ? `${built.prompt}\nAjustements demandés par l'utilisateur (à respecter) : ${refinements.join(" ; ")}.`
      : built.prompt;
    return { ...built, prompt };
  }

  /** Génère (ou régénère) l'aperçu, avec un éventuel ajustement supplémentaire. */
  async function generateRecapPreview(extra?: string) {
    if (recapPreviewLoading || recapTopicIds.length === 0 || recapInvalid) return;
    const nextRefs = extra?.trim() ? [...refinements, extra.trim()] : refinements;
    setRefinements(nextRefs);
    setRefinement("");
    setRecapPreviewLoading(true);
    setRecapPreviewError(null);
    try {
      const built = buildRecapRoutine({
        agentKey,
        periodKind: recapPeriod,
        from: recapFrom || undefined,
        to: recapTo || undefined,
        topicIds: recapTopicIds,
      });
      const prompt = nextRefs.length
        ? `${built.prompt}\nAjustements demandés par l'utilisateur (à respecter) : ${nextRefs.join(" ; ")}.`
        : built.prompt;
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt + ROUTINE_REPORT_DIRECTIVE }],
          sources: sourceKeys,
          attachments: [],
        }),
      });
      const raw = await res.text();
      let data: { error?: string; message?: string; report?: unknown; chartProposal?: unknown };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(res.ok ? "Réponse illisible du serveur" : `Le serveur n'a pas répondu à temps (erreur ${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || "Erreur agent");
      const report = (data.report ?? null) as ReportSpec | null;
      const chart = (data.chartProposal ?? null) as ChartProposal | null;
      if (!report && !chart) throw new Error("L'agent n'a pas renvoyé de rapport visuel — reformule ou réessaie");
      setRecapPreview({ report, chart, analysis: typeof data.message === "string" ? data.message : null });
    } catch (e) {
      setRecapPreviewError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setRecapPreviewLoading(false);
    }
  }

  function createRecap() {
    if (recapTopicIds.length === 0 || recapInvalid) return;
    const built = currentRecap();
    addRoutine({ agentKey, label: built.label, prompt: built.prompt, frequency: built.frequency, time: recapTime });
    // L'aperçu validé devient le premier rapport de la routine — pas besoin
    // d'attendre la prochaine occurrence pour le retrouver.
    if (recapPreview) {
      const title = recapPreview.report?.title || recapPreview.chart?.title || built.label;
      addSavedReport({
        agentKey,
        agentLabel,
        title,
        summary: recapPreview.report?.summary || recapPreview.chart?.summary,
        report: recapPreview.report,
        chart: recapPreview.chart,
        alert: {
          title,
          description: recapPreview.report?.summary || recapPreview.chart?.summary || `Rapport généré par la routine « ${built.label} ».`,
          category: "revops",
          channels: [],
        },
        origin: "routine",
        routineLabel: built.label,
        analysis: recapPreview.analysis ?? undefined,
      });
    }
    setRecapTopicIds([]);
    setRecapFrom("");
    setRecapTo("");
    setRecapPreview(null);
    setRefinements([]);
  }

  const activeLabels = new Set(routines.map((r) => r.label));
  const suggestions = routineSuggestionsFor(agentKey).filter((s) => !activeLabels.has(s.label));

  function activateSuggestion(s: { label: string; prompt: string; frequency: RoutineFrequency; time: string }) {
    addRoutine({ agentKey, label: s.label, prompt: s.prompt, frequency: s.frequency, time: s.time });
  }

  function createCustom() {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    const label = prompt.length > 60 ? `${prompt.slice(0, 60)}…` : prompt;
    addRoutine({ agentKey, label, prompt, frequency: customFreq, time: customTime });
    setCustomPrompt("");
  }

  const field =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";

  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
      <p className="text-xs text-slate-400">
        Les routines sont des questions récurrentes posées automatiquement à {agentLabel} : le rapport est généré
        <span className="font-medium text-slate-600"> côté serveur à l&apos;heure programmée — même si Revold est fermé</span> —
        puis enregistré dans «&nbsp;Rapports enregistrés&nbsp;» avec le badge{" "}
        <span className="font-medium text-slate-600">🕘 Routine</span>, visible par toute l&apos;équipe. Une notification
        (cloche) te prévient à chaque exécution.
      </p>

      {/* ── Routines actives ── */}
      {routines.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">Mes routines ({routines.length})</p>
          {routines.map((r) => {
            const running = runningIds.includes(r.id);
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${r.active ? "border-fuchsia-200 bg-fuchsia-50/40" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      🕘 {r.label}
                      {!r.active && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">en pause</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {FREQUENCY_LABELS[r.frequency]} à {r.time} · {fmtLastRun(r.lastRunAt)}
                    </p>
                    {r.lastError && <p className="mt-0.5 text-[11px] text-red-500">⚠ Dernière exécution échouée : {r.lastError}</p>}
                  </div>
                  <button
                    onClick={() => removeRoutine(r.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={r.frequency}
                    onChange={(e) => updateRoutine(r.id, { frequency: e.target.value as RoutineFrequency })}
                    className={field}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={r.time}
                    onChange={(e) => updateRoutine(r.id, { time: e.target.value || "09:00" })}
                    className={field}
                  />
                  <button
                    onClick={() => updateRoutine(r.id, { active: !r.active })}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {r.active ? "⏸ Mettre en pause" : "▶ Réactiver"}
                  </button>
                  <button
                    onClick={() => onRunNow(r)}
                    disabled={running}
                    className="ml-auto rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {running ? "Génération du rapport…" : "Exécuter maintenant"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Constructeur de récap sur mesure : période + thèmes MACRO ── */}
      <div className="rounded-xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/60 via-white to-white p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600">
          <span aria-hidden>🕘</span> Créer un récap sur mesure
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Choisis la période, puis les KPIs macro à couvrir — {agentLabel} génère un récap agrégé (chiffres clés,
          tendances, comparaisons), sans listes détaillées.
        </p>

        {/* 1. Période du récap */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {RECAP_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickRecapPeriod(p.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                recapPeriod === p.id
                  ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {recapPeriod === "custom" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-slate-400">Du</label>
            <input type="date" value={recapFrom} max={recapTo || undefined} onChange={(e) => setRecapFrom(e.target.value)} className={field} />
            <label className="text-[11px] text-slate-400">au</label>
            <input type="date" value={recapTo} min={recapFrom || undefined} onChange={(e) => setRecapTo(e.target.value)} className={field} />
            {recapInvalid && <span className="text-[11px] text-rose-500">Renseigne les deux dates (début ≤ fin).</span>}
          </div>
        )}

        {/* 2. Thèmes de KPIs macro propres à cet agent */}
        <p className="mt-3 text-[11px] font-semibold text-slate-600">KPIs macro à couvrir</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {recapTopics.map((t) => {
            const on = recapTopicIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleRecapTopic(t.id)}
                title={t.detail}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  on
                    ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
                }`}
              >
                {on ? "✓ " : ""}{t.label}
              </button>
            );
          })}
        </div>

        {/* 3. Heure + aperçu avant enregistrement */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="time" value={recapTime} onChange={(e) => setRecapTime(e.target.value || "09:00")} className={field} />
          <span className="text-[11px] text-slate-400">
            généré {FREQUENCY_LABELS[RECAP_PERIODS.find((p) => p.id === recapPeriod)!.frequency].toLowerCase()}
          </span>
          <button
            onClick={() => generateRecapPreview()}
            disabled={recapTopicIds.length === 0 || recapInvalid || recapPreviewLoading}
            className="ml-auto rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {recapPreviewLoading ? "Génération de l'aperçu…" : recapPreview ? "🔄 Régénérer l'aperçu" : "👁 Aperçu du récap"}
          </button>
        </div>
        {recapPreviewError && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{recapPreviewError}</p>
        )}

        {/* 4. Aperçu généré par l'agent — ajustable avant enregistrement */}
        {recapPreview && (
          <div className="mt-3 space-y-3 border-t border-fuchsia-100 pt-3">
            <p className="text-[11px] font-semibold text-slate-600">
              Aperçu du récap — retire un KPI (✕), réordonne les blocs (glisser-déposer), ajoute un KPI câblé,
              ou ajuste via {agentLabel}. Puis enregistre.
            </p>
            {recapPreview.report ? (
              <RecapPreviewEditor
                spec={recapPreview.report}
                onChange={(spec) => setRecapPreview((p) => (p ? { ...p, report: spec } : p))}
                agentKey={agentKey}
                sourceKeys={sourceKeys}
              />
            ) : recapPreview.chart ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <ReportChart block={{ type: (recapPreview.chart.defaultType || "bar") as ReportBlock["type"], data: recapPreview.chart.data }} />
              </div>
            ) : null}
            {recapPreview.analysis && (
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                {recapPreview.analysis}
              </p>
            )}

            {/* Ajustements via l'agent */}
            {refinements.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {refinements.map((r, i) => (
                  <span key={i} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                    ✎ {r}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generateRecapPreview(refinement); }}
                placeholder={`Ex : ajoute le churn, retire la projection — ${agentLabel} régénère l'aperçu`}
                className={`${field} min-w-0 flex-1`}
              />
              <button
                onClick={() => generateRecapPreview(refinement)}
                disabled={!refinement.trim() || recapPreviewLoading}
                className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100 disabled:opacity-50"
              >
                ✨ Ajuster
              </button>
              <button
                onClick={createRecap}
                disabled={recapPreviewLoading}
                className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                💾 Enregistrer le récap
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Suggestions de routines adaptées au coach ── */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">Routines suggérées</p>
          {suggestions.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">🕘 {s.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400" title={s.prompt}>
                  {FREQUENCY_LABELS[s.frequency]} à {s.time} · {s.prompt}
                </p>
              </div>
              <button
                onClick={() => activateSuggestion(s)}
                className="shrink-0 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
              >
                ＋ Activer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Routine personnalisée ── */}
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold text-slate-600">Créer une routine personnalisée</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCustom();
            }}
            placeholder="Ex : récap des deals à risque de la semaine"
            className={`${field} min-w-0 flex-1`}
          />
          <select value={customFreq} onChange={(e) => setCustomFreq(e.target.value as RoutineFrequency)} className={field}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
            ))}
          </select>
          <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value || "09:00")} className={field} />
          <button
            onClick={createCustom}
            disabled={!customPrompt.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
