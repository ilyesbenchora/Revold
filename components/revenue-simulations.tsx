"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertButton } from "@/components/alert-button";

type Pipeline = {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string; probability: number; closedWon: boolean; closedLost: boolean }>;
};

type RevenueSim = {
  title: string;
  description: string;
  impact: string;
  category: string;
  simulationCategory: "cycle_ventes";
  section: "growth" | "ticket" | "forecast" | "retention";
  color: string;
  forecastType: string;
  threshold: number;
  direction: "above" | "below";
  pipelineId: string;
  pipelineLabel: string;
};

type Sections = {
  growth: RevenueSim[];
  ticket: RevenueSim[];
  forecast: RevenueSim[];
  retention: RevenueSim[];
};

type Counts = {
  totalDeals: number;
  wonAmount: number;
  openAmount: number;
  weightedPipeline: number;
  forecastNext30Days: number;
  forecastNext90Days: number;
  avgWonAmount: number;
};

type Props = {
  pipelines: Pipeline[];
};

const SECTION_META: Record<keyof Sections, { label: string; emoji: string; gradient: string; description: string }> = {
  growth: {
    label: "Croissance Revenue",
    emoji: "📈",
    gradient: "from-emerald-500 to-cyan-600",
    description: "CA cumulé, pipeline pondéré, couverture quarter — leviers de croissance",
  },
  ticket: {
    label: "Ticket moyen",
    emoji: "💎",
    gradient: "from-emerald-500 to-blue-600",
    description: "Augmenter la valeur par deal (pricing, bundling, upsell ciblé)",
  },
  forecast: {
    label: "Forecast Cash",
    emoji: "💰",
    gradient: "from-emerald-500 to-teal-600",
    description: "Prévision encaissement 30j / 90j / quarter avec discipline forecast",
  },
  retention: {
    label: "Retention / Expansion",
    emoji: "🔁",
    gradient: "from-emerald-500 to-fuchsia-600",
    description: "Renouvellement, NRR, win-back, expansion (adapté au type de pipeline détecté)",
  },
};

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M€`
    : n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

function SimulationCard({ sim }: { sim: RevenueSim }) {
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
            description={`${sim.description} (Pipeline ${sim.pipelineLabel})`}
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

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new_business: { label: "New Business", color: "bg-blue-100 text-blue-700" },
  renewal: { label: "Renewal", color: "bg-emerald-100 text-emerald-700" },
  upsell: { label: "Upsell / Expansion", color: "bg-fuchsia-100 text-fuchsia-700" },
  other: { label: "Pipeline générique", color: "bg-slate-100 text-slate-700" },
};

export function RevenueSimulations({ pipelines }: Props) {
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0]?.id ?? "");
  const [sections, setSections] = useState<Sections | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [inferredType, setInferredType] = useState<string>("other");
  const [loading, setLoading] = useState(false);

  const currentPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  );

  useEffect(() => {
    if (!pipelineId) return;
    setLoading(true);
    fetch(`/api/simulations/revenue?pipeline=${pipelineId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sections) {
          setSections(data.sections);
          setCounts(data.counts ?? null);
          setInferredType(data.inferredType ?? "other");
        } else {
          setSections({ growth: [], ticket: [], forecast: [], retention: [] });
          setCounts(null);
        }
      })
      .catch(() => {
        setSections({ growth: [], ticket: [], forecast: [], retention: [] });
        setCounts(null);
      })
      .finally(() => setLoading(false));
  }, [pipelineId]);

  if (pipelines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          Aucun pipeline détecté dans HubSpot. Connectez votre CRM pour activer les simulations Revenue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur Pipeline (single) */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pipeline pour les simulations Revenue (un seul)
          </label>
          <p className="mb-3 text-xs text-slate-500">
            Selon le pipeline (New Business / Renewal / Upsell), les simulations Revenue
            s&apos;adaptent automatiquement (focus run rate / retention / expansion).
          </p>
          <div className="flex flex-wrap gap-2">
            {pipelines.map((p) => {
              const active = p.id === pipelineId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPipelineId(p.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
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

        {/* Type de pipeline détecté + résumé counts */}
        {currentPipeline && counts && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-slate-500">Type détecté :</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  TYPE_LABELS[inferredType]?.color ?? TYPE_LABELS.other.color
                }`}
              >
                {TYPE_LABELS[inferredType]?.label ?? "Pipeline générique"}
              </span>
              <span className="text-[10px] text-slate-400">
                — détermine le focus de la section &quot;Retention / Expansion&quot;
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-4 lg:grid-cols-6">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Deals total</p>
                <p className="text-base font-bold text-slate-900">{counts.totalDeals.toLocaleString("fr-FR")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">CA gagné</p>
                <p className="text-base font-bold text-emerald-600">{fmtMoney(counts.wonAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Pipeline ouvert</p>
                <p className="text-base font-bold text-slate-900">{fmtMoney(counts.openAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Pondéré</p>
                <p className="text-base font-bold text-slate-900">{fmtMoney(counts.weightedPipeline)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Forecast 30j</p>
                <p className="text-base font-bold text-slate-900">{fmtMoney(counts.forecastNext30Days)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Ticket moyen</p>
                <p className="text-base font-bold text-slate-900">{fmtMoney(counts.avgWonAmount)}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sections */}
      {loading && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Génération des simulations Revenue en cours...
        </div>
      )}

      {!loading && sections && (
        <div className="space-y-8">
          {(Object.keys(SECTION_META) as Array<keyof Sections>).map((key) => {
            const meta = SECTION_META[key];
            const sims = sections[key] ?? [];
            return (
              <section key={key} className="space-y-3">
                <header>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <span aria-hidden>{meta.emoji}</span>
                    {meta.label}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {sims.length}
                    </span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
                </header>

                {sims.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                    Aucune simulation pour ce pipeline. Sélectionne un pipeline avec plus de données revenue.
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
