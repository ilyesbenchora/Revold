"use client";

import { useEffect, useRef, useState } from "react";
import {
  FREQUENCY_LABELS,
  ROUTINE_REPORT_DIRECTIVE,
  routineSuggestionsFor,
  type RoutineFrequency,
} from "@/lib/ai/agents/routine-catalog";
import {
  addRoutine,
  isRoutineDue,
  listAgentRoutines,
  removeRoutine,
  updateRoutine,
  ROUTINES_UPDATED_EVENT,
  type Routine,
} from "./routines";
import { addSavedReport } from "./saved-reports";
import type { ReportSpec, ChartProposal } from "@/lib/ai/agents/agent-runtime";

const FREQUENCIES: RoutineFrequency[] = ["daily", "weekly", "monthly"];

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
 * Exécution des routines de l'agent : vérifie à l'ouverture (puis chaque
 * minute) si une routine est échue, pose la question à l'agent avec la
 * directive « rapport visuel » (même qualité que les tables de données), et
 * enregistre le rapport dans « Rapports enregistrés » avec le badge Routine.
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
      let data: { error?: string; report?: unknown; chartProposal?: unknown };
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
      });
    } catch (e) {
      updateRoutine(r.id, { lastError: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      runningRef.current.delete(r.id);
      setRunningIds([...runningRef.current]);
    }
  }

  // Vérification des routines échues à l'arrivée, puis toutes les minutes.
  useEffect(() => {
    const tick = () => {
      for (const r of listAgentRoutines(agentKey)) {
        if (isRoutineDue(r)) void runRoutine(r);
      }
    };
    tick();
    const iv = setInterval(tick, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
}: {
  agentKey: string;
  agentLabel: string;
  routines: Routine[];
  runningIds: string[];
  onRunNow: (r: Routine) => void;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [customFreq, setCustomFreq] = useState<RoutineFrequency>("daily");

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
        Les routines sont des questions récurrentes posées automatiquement à {agentLabel} : le rapport est généré à
        l&apos;heure programmée (à l&apos;ouverture de la page si elle est passée) et enregistré dans «&nbsp;Rapports
        enregistrés&nbsp;» avec le badge <span className="font-medium text-slate-600">🕘 Routine</span>.
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
