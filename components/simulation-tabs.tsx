"use client";

import { useMemo, useState } from "react";
import { AlertButton } from "@/components/alert-button";
import { CycleVentesSimulations } from "@/components/cycle-ventes-simulations";
import { RevenueSimulations } from "@/components/revenue-simulations";

type Pipeline = {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string; probability: number; closedWon: boolean; closedLost: boolean }>;
};

export type SimulationItem = {
  title: string;
  description: string;
  impact: string;
  category: string;
  simulationCategory: "cycle_ventes" | "marketing_cycle" | "revenue" | "data_quality";
  color: string;
  forecastType?: string;
  threshold?: number;
  direction?: "above" | "below";
};

export type AlertItem = {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: string;
  status: string; // 'active' | 'resolved'
  forecast_type: string | null;
  threshold: number | null;
  current_value: number | null;
  direction: string | null;
  last_checked: string | null;
  created_at: string;
  resolved_at: string | null;
};

const FORECAST_UNITS: Record<string, string> = {
  closing_rate: "%",
  conversion_rate: "%",
  pipeline_coverage: "%",
  orphan_rate: "%",
  deal_activation: "%",
  phone_enrichment: "%",
  pipeline_value: "€",
  dormant_reactivation: "",
};

const CATEGORY_COLORS: Record<string, { dot: string; badge: string }> = {
  sales: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700" },
  marketing: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  data: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  process: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  csm: { dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700" },
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Ventes",
  marketing: "Marketing",
  data: "Data",
  process: "Process",
  csm: "CSM",
};

type TabId = "cycle_ventes" | "marketing_cycle" | "revenue" | "data_quality";

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "cycle_ventes", label: "Cycle de ventes", emoji: "🚀" },
  { id: "marketing_cycle", label: "Marketing cycle", emoji: "🔄" },
  { id: "revenue", label: "Revenue", emoji: "💰" },
  { id: "data_quality", label: "Données", emoji: "🛡️" },
];

function progressPercent(current: number, threshold: number, direction: string): number {
  if (direction === "below") {
    if (current <= threshold) return 100;
    const maxReasonable = Math.max(current * 1.5, threshold * 3);
    return Math.max(0, Math.min(100, Math.round(((maxReasonable - current) / (maxReasonable - threshold)) * 100)));
  }
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / threshold) * 100)));
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const colors = CATEGORY_COLORS[alert.category] ?? CATEGORY_COLORS.sales;
  const unit = alert.forecast_type ? (FORECAST_UNITS[alert.forecast_type] || "") : "";
  const hasKpi = alert.forecast_type && alert.threshold != null && alert.current_value != null;
  const progress = hasKpi ? progressPercent(alert.current_value!, alert.threshold!, alert.direction || "above") : null;
  const isResolved = alert.status === "resolved";

  return (
    <article className={`card p-5 ${isResolved ? "border-emerald-200" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors.badge}`}>
            {CATEGORY_LABELS[alert.category] ?? alert.category}
          </span>
          {isResolved ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Objectif atteint</span>
          ) : (
            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700">En cours</span>
          )}
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>Créée le {new Date(alert.created_at).toLocaleDateString("fr-FR")}</p>
          {isResolved && alert.resolved_at && <p>Atteint le {new Date(alert.resolved_at).toLocaleDateString("fr-FR")}</p>}
        </div>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{alert.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{alert.description}</p>

      {hasKpi && progress != null && !isResolved && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-500">Valeur actuelle</p>
              <p className="text-xl font-bold text-slate-900">
                {alert.current_value!.toLocaleString("fr-FR")}{unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Objectif</p>
              <p className="text-xl font-bold text-accent">
                {alert.direction === "below" ? "< " : ""}{alert.threshold!.toLocaleString("fr-FR")}{unit}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Progression</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  progress >= 100 ? "bg-emerald-500" : progress >= 70 ? "bg-accent" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
          {alert.last_checked && (
            <p className="mt-2 text-[10px] text-slate-400">
              Dernière vérification : {new Date(alert.last_checked).toLocaleString("fr-FR", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      {isResolved && hasKpi && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {alert.current_value!.toLocaleString("fr-FR")}{unit} atteint
            </p>
            <p className="text-xs text-emerald-600">
              Objectif de {alert.threshold!.toLocaleString("fr-FR")}{unit} dépassé
            </p>
          </div>
        </div>
      )}

      {!hasKpi && (
        <div className={`mt-3 flex items-center gap-2 rounded-lg px-4 py-2 ${isResolved ? "bg-emerald-50" : "bg-slate-50"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isResolved ? "text-emerald-600" : "text-indigo-500"}>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <p className={`text-sm font-medium ${isResolved ? "text-emerald-800" : "text-slate-800"}`}>{alert.impact}</p>
        </div>
      )}
    </article>
  );
}

function SimulationCard({ sim }: { sim: SimulationItem }) {
  const colors = CATEGORY_COLORS[sim.category] ?? CATEGORY_COLORS.sales;
  // sim.color est désormais un gradient Tailwind tel que "from-blue-500 to-indigo-600"
  const gradient = sim.color || "from-slate-500 to-slate-700";

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-xl hover:-translate-y-0.5">
      {/* Bandeau gradient en haut */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

      {/* Halo coloré décoratif (top-right) */}
      <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl transition group-hover:opacity-20`} />

      <div className="relative flex flex-col gap-4 p-5">
        {/* Badge équipe */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 items-center rounded-full bg-gradient-to-r ${gradient} px-2.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm`}>
              {CATEGORY_LABELS[sim.category] ?? sim.category}
            </span>
          </div>
          <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
        </div>

        {/* Titre principal — taille volontairement grande */}
        <h3 className="text-base font-bold leading-tight text-slate-900">
          {sim.title}
        </h3>

        {/* Description courte */}
        <p className="text-xs leading-relaxed text-slate-600">{sim.description}</p>

        {/* Bloc Impact — la pièce maîtresse, gradient + gros texte */}
        <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-3.5 shadow-sm`}>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/25 backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/80">
                Impact estimé
              </p>
              <p className="mt-0.5 text-sm font-bold leading-snug text-white">
                {sim.impact}
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto">
          <AlertButton
            title={sim.title}
            description={sim.description}
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

export function SimulationTabs({
  scenarios,
  alerts,
  pipelines = [],
}: {
  scenarios: SimulationItem[];
  alerts: AlertItem[];
  pipelines?: Pipeline[];
}) {
  const [tab, setTab] = useState<TabId>("cycle_ventes");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Counts par onglet
  const counts = useMemo(() => ({
    cycle_ventes: scenarios.filter((s) => s.simulationCategory === "cycle_ventes").length,
    marketing_cycle: scenarios.filter((s) => s.simulationCategory === "marketing_cycle").length,
    revenue: scenarios.filter((s) => s.simulationCategory === "revenue").length,
    data_quality: scenarios.filter((s) => s.simulationCategory === "data_quality").length,
  }), [scenarios]);

  // Items affichables selon l'onglet
  const tabScenarios = useMemo(() => {
    return scenarios.filter((s) => s.simulationCategory === tab);
  }, [tab, scenarios]);

  // Equipes disponibles dans l'onglet courant pour le filtre
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    for (const s of tabScenarios) set.add(s.category);
    return [...set];
  }, [tabScenarios]);

  // Filtrage par équipe
  const filteredScenarios = useMemo(
    () => (teamFilter === "all" ? tabScenarios : tabScenarios.filter((s) => s.category === teamFilter)),
    [tabScenarios, teamFilter],
  );

  function onTabChange(t: TabId) {
    setTab(t);
    setTeamFilter("all");
  }

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`flex-1 min-w-fit rounded-md px-3 py-1.5 text-xs font-medium transition flex items-center justify-center gap-2 ${
                active ? "bg-white text-accent shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span aria-hidden>{t.emoji}</span>
              <span>{t.label}</span>
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  active ? "bg-accent text-white" : "bg-accent/15 text-accent"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chips filtre par équipe */}
      {availableTeams.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mr-1">
            Équipe :
          </span>
          <button
            type="button"
            onClick={() => setTeamFilter("all")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              teamFilter === "all" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Toutes ({tabScenarios.length})
          </button>
          {availableTeams.map((t) => {
            const selected = teamFilter === t;
            const cnt = tabScenarios.filter((x) => x.category === t).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTeamFilter(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  selected ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {CATEGORY_LABELS[t] ?? t} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Contenu */}
      {tab === "cycle_ventes" ? (
        // Onglet Cycle de ventes : composant dédié avec sélecteurs pipeline + stages
        // qui génère 4 sections (velocity, risk, forecast, analytics) dynamiquement.
        <CycleVentesSimulations pipelines={pipelines} />
      ) : tab === "revenue" ? (
        // Onglet Revenue : sélecteur pipeline single (les simulations s'adaptent
        // au type détecté : new_business / renewal / upsell). 4 sections :
        // growth / ticket / forecast / retention.
        <RevenueSimulations pipelines={pipelines} />
      ) : (
        filteredScenarios.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-500">Aucune simulation disponible dans cette catégorie pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredScenarios.map((s, i) => <SimulationCard key={i} sim={s} />)}
          </div>
        )
      )}
    </div>
  );
}
