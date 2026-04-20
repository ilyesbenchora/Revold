"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertButton } from "@/components/alert-button";

type Pipeline = {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string; probability: number; closedWon: boolean; closedLost: boolean }>;
};

type SmartSim = {
  title: string;
  description: string;
  impact: string;
  category: string;
  simulationCategory: "cycle_ventes";
  section: "velocity" | "risk" | "forecast" | "analytics";
  color: string;
  forecastType: string;
  threshold: number;
  direction: "above" | "below";
  pipelineId: string;
  pipelineLabel: string;
  selectedStageIds: string[];
};

type Sections = {
  velocity: SmartSim[];
  risk: SmartSim[];
  forecast: SmartSim[];
  analytics: SmartSim[];
};

type Props = {
  pipelines: Pipeline[];
};

const SECTION_META: Record<keyof Sections, { label: string; emoji: string; gradient: string; description: string }> = {
  velocity: {
    label: "Vélocité Pipeline",
    emoji: "🚀",
    gradient: "from-blue-500 to-indigo-600",
    description: "Accélérer le mouvement des deals dans le pipeline (cycle, suivi, stages lents)",
  },
  risk: {
    label: "Deals à risque",
    emoji: "⚠️",
    gradient: "from-rose-500 to-orange-600",
    description: "Identifier et traiter les deals en danger (stagnation, faible probabilité, sans suivi)",
  },
  forecast: {
    label: "Forecast CA",
    emoji: "📊",
    gradient: "from-emerald-500 to-teal-600",
    description: "Prévision du chiffre d'affaires sur 30j / 90j / quarter avec discipline forecast",
  },
  analytics: {
    label: "CA Analytics",
    emoji: "💰",
    gradient: "from-fuchsia-500 to-emerald-600",
    description: "Analyse de la performance revenue : ticket moyen, win rate, attribution, cohorts",
  },
};

function SimulationCard({ sim }: { sim: SmartSim }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-xl hover:-translate-y-0.5">
      <div className={`h-1.5 bg-gradient-to-r ${sim.color}`} />
      <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${sim.color} opacity-10 blur-2xl transition group-hover:opacity-20`} />

      <div className="relative flex flex-col gap-4 p-5">
        <h3 className="text-base font-bold leading-tight text-slate-900">{sim.title}</h3>
        <p className="text-xs leading-relaxed text-slate-600">{sim.description}</p>

        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${sim.color} p-3.5 shadow-sm`}>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/25 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/80">Impact estimé</p>
              <p className="mt-0.5 text-sm font-bold leading-snug text-white">{sim.impact}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <AlertButton
            title={sim.title}
            description={`${sim.description} (Pipeline ${sim.pipelineLabel}${sim.selectedStageIds.length > 0 ? ` · ${sim.selectedStageIds.length} étape${sim.selectedStageIds.length > 1 ? "s" : ""}` : ""})`}
            impact={sim.impact}
            category={sim.category}
            forecastType={sim.forecastType}
            threshold={sim.threshold}
            direction={sim.direction}
          />
        </div>
      </div>
    </article>
  );
}

export function CycleVentesSimulations({ pipelines }: Props) {
  // Sélection : 1 pipeline (default = 1er) + N stages (default = all = [])
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0]?.id ?? "");
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [sections, setSections] = useState<Sections | null>(null);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ totalDeals: number; totalAmount: number; atRiskCount: number; stagnantCount: number } | null>(null);

  const currentPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  );

  useEffect(() => {
    if (!pipelineId) return;
    setLoading(true);
    const stagesParam = stageIds.length === 0 ? "all" : stageIds.join(",");
    fetch(`/api/simulations/cycle-ventes?pipeline=${pipelineId}&stages=${encodeURIComponent(stagesParam)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sections) {
          setSections(data.sections);
          setCounts(data.counts ?? null);
        } else {
          setSections({ velocity: [], risk: [], forecast: [], analytics: [] });
          setCounts(null);
        }
      })
      .catch(() => {
        setSections({ velocity: [], risk: [], forecast: [], analytics: [] });
        setCounts(null);
      })
      .finally(() => setLoading(false));
  }, [pipelineId, stageIds]);

  function changePipeline(id: string) {
    setPipelineId(id);
    setStageIds([]); // reset stages quand on change de pipeline
  }

  function toggleStage(id: string) {
    setStageIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function selectAllStages() {
    setStageIds([]);
  }

  if (pipelines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          Aucun pipeline détecté dans HubSpot. Connectez votre CRM pour activer les simulations Cycle de Ventes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Sélecteurs ── */}
      <div className="card p-5 space-y-4">
        {/* Pipeline (single select) */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pipeline (un seul)
          </label>
          <div className="flex flex-wrap gap-2">
            {pipelines.map((p) => {
              const active = p.id === pipelineId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => changePipeline(p.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                  <span className={`ml-1.5 text-[10px] ${active ? "text-white/80" : "text-slate-400"}`}>
                    ({p.stages.length} étapes)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stages (multi select) */}
        {currentPipeline && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Étapes du pipeline (une, plusieurs ou toutes)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllStages}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  stageIds.length === 0
                    ? "bg-accent text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Toutes ({currentPipeline.stages.length})
              </button>
              {currentPipeline.stages.map((s) => {
                const active = stageIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStage(s.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-accent text-white"
                        : s.closedWon
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : s.closedLost
                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {active && <span className="mr-1">✓</span>}
                    {s.label}
                    <span className={`ml-1 text-[10px] ${active ? "text-white/80" : "text-slate-400"}`}>
                      {s.probability}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Résumé sélection */}
        {counts && (
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-slate-500">Deals dans la sélection</p>
              <p className="text-lg font-bold text-slate-900">{counts.totalDeals.toLocaleString("fr-FR")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Montant total</p>
              <p className="text-lg font-bold text-slate-900">
                {counts.totalAmount >= 1000
                  ? `${Math.round(counts.totalAmount / 1000).toLocaleString("fr-FR")}K€`
                  : `${Math.round(counts.totalAmount)}€`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">À risque</p>
              <p className={`text-lg font-bold ${counts.atRiskCount > 0 ? "text-rose-600" : "text-slate-400"}`}>
                {counts.atRiskCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Stagnants</p>
              <p className={`text-lg font-bold ${counts.stagnantCount > 0 ? "text-orange-600" : "text-slate-400"}`}>
                {counts.stagnantCount}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Sections de simulations ── */}
      {loading && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Génération des simulations SMART en cours...
        </div>
      )}

      {!loading && sections && (
        <div className="space-y-8">
          {(Object.keys(SECTION_META) as Array<keyof Sections>).map((key) => {
            const meta = SECTION_META[key];
            const sims = sections[key] ?? [];
            return (
              <section key={key} className="space-y-3">
                <header className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      <span aria-hidden>{meta.emoji}</span>
                      {meta.label}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {sims.length}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
                  </div>
                </header>

                {sims.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                    Aucune simulation pour cette sélection. Choisis d&apos;autres étapes ou un pipeline avec plus de deals.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {sims.map((sim, i) => (
                      <SimulationCard key={`${key}-${i}`} sim={sim} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
