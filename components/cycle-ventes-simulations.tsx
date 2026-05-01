"use client";

import { useEffect, useState } from "react";
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

// On garde les 4 keys côté API pour compat ascendante mais l'UI n'en rend
// plus que 2 : velocity + risk. Forecast/Analytics relèvent de l'onglet Revenue.
type Sections = {
  velocity: SmartSim[];
  risk: SmartSim[];
  forecast: SmartSim[];
  analytics: SmartSim[];
};

type Props = {
  pipelines: Pipeline[];
};

type VisibleKey = "velocity" | "risk";
const VISIBLE_SECTIONS: VisibleKey[] = ["velocity", "risk"];

const SECTION_META: Record<VisibleKey, { label: string; emoji: string; gradient: string; description: string }> = {
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
};

function SimulationCard({ sim, pipeline }: { sim: SmartSim; pipeline: Pipeline | null }) {
  // Reconstitue le nom des stages scopées si la sim cible une étape précise
  const scopedStageLabels = pipeline
    ? sim.selectedStageIds
        .map((id) => pipeline.stages.find((s) => s.id === id)?.label)
        .filter((l): l is string => !!l)
    : [];
  const isStageScoped = scopedStageLabels.length > 0 && scopedStageLabels.length < (pipeline?.stages.length ?? 999);

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-xl hover:-translate-y-0.5">
      <div className={`h-1.5 bg-gradient-to-r ${sim.color}`} />
      <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${sim.color} opacity-10 blur-2xl transition group-hover:opacity-20`} />

      <div className="relative flex flex-col gap-4 p-5">
        {isStageScoped && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {scopedStageLabels.map((lbl) => (
              <span key={lbl} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                🎯 {lbl}
              </span>
            ))}
          </div>
        )}
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
            description={`${sim.description} (Pipeline ${sim.pipelineLabel}${isStageScoped ? ` · ${scopedStageLabels.join(" + ")}` : ""})`}
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
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0]?.id ?? "");
  const [sections, setSections] = useState<Sections | null>(null);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ totalDeals: number; totalAmount: number; atRiskCount: number; stagnantCount: number } | null>(null);

  const currentPipeline = pipelines.find((p) => p.id === pipelineId) ?? null;

  useEffect(() => {
    if (!pipelineId) return;
    setLoading(true);
    // On ne filtre plus par stages — toutes les étapes sont analysées et
    // la library génère des simulations stage-par-stage automatiquement.
    fetch(`/api/simulations/cycle-ventes?pipeline=${pipelineId}&stages=all`)
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
  }, [pipelineId]);

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
      {/* ── Sélecteur pipeline discret ── */}
      <div className="flex items-center gap-2 text-xs">
        <label htmlFor="pipeline-select" className="text-slate-500">
          Pipeline :
        </label>
        <select
          id="pipeline-select"
          value={pipelineId}
          onChange={(e) => setPipelineId(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-300 focus:outline-none"
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Sections de simulations ── */}
      {loading && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Génération des simulations SMART en cours...
        </div>
      )}

      {!loading && sections && (
        <div className="space-y-8">
          {VISIBLE_SECTIONS.map((key) => {
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
                    Aucune simulation pour ce pipeline — les KPIs sont dans les benchmarks.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {sims.map((sim, i) => (
                      <SimulationCard key={`${key}-${i}`} sim={sim} pipeline={currentPipeline} />
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
