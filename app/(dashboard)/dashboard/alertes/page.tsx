import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ScenarioCarousel } from "@/components/scenario-carousel";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { buildContext, buildScenarios } from "../insights-ia/context";

type Alert = {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: string;
  status: string;
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

function progressPercent(current: number, threshold: number, direction: string): number {
  if (direction === "below") {
    // For "below" direction: 100% at start, progress as value decreases toward threshold
    // e.g., orphan rate 40% → target 20% → progress = how far we've come from start toward target
    if (current <= threshold) return 100;
    // We don't know the start value, so show relative progress: how close to threshold
    const maxReasonable = Math.max(current * 1.5, threshold * 3);
    return Math.max(0, Math.min(100, Math.round(((maxReasonable - current) / (maxReasonable - threshold)) * 100)));
  }
  // "above" direction
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / threshold) * 100)));
}

export default async function ScenariosPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const [ctx, { data: allAlerts }] = await Promise.all([
    buildContext(supabase, orgId),
    supabase
      .from("alerts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const scenarios = buildScenarios(ctx);
  const alerts = (allAlerts ?? []) as Alert[];
  const activeAlerts = alerts.filter((a) => a.status === "active");
  const resolvedAlerts = alerts.filter((a) => a.status === "resolved");

  const categoryColors: Record<string, { dot: string; badge: string }> = {
    sales: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700" },
    marketing: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
    data: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
    process: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  };

  const categoryLabels: Record<string, string> = {
    sales: "Commercial",
    marketing: "Marketing",
    data: "Data",
    process: "Process",
  };

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Scénarios de simulation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Simulez l&apos;impact d&apos;améliorations sur vos KPIs et créez des alertes personnalisées pour suivre vos objectifs.
          </p>
        </div>
        <CreateAlertModal />
      </header>

      {/* Scénarios carrousel */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
          </svg>
          Simulations disponibles
          <span className="text-xs text-slate-400">{scenarios.length} scénarios</span>
        </h2>
        <ScenarioCarousel scenarios={scenarios} />
      </div>

      {/* Alertes en cours */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Alertes en cours
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{activeAlerts.length}</span>
          </h2>
        }
      >
        {activeAlerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">Aucune alerte active. Activez un scénario ci-dessus ou créez une alerte personnalisée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.map((alert) => {
              const colors = categoryColors[alert.category] ?? categoryColors.sales;
              const unit = alert.forecast_type ? (FORECAST_UNITS[alert.forecast_type] || "") : "";
              const hasKpi = alert.forecast_type && alert.threshold != null && alert.current_value != null;
              const progress = hasKpi
                ? progressPercent(alert.current_value!, alert.threshold!, alert.direction || "above")
                : null;

              return (
                <article key={alert.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                        {categoryLabels[alert.category] ?? alert.category}
                      </span>
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700">En cours</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(alert.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{alert.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{alert.description}</p>

                  {/* KPI Progress */}
                  {hasKpi && progress != null && (
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
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  )}

                  {!hasKpi && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                      <p className="text-sm font-medium text-slate-800">{alert.impact}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </CollapsibleBlock>

      {/* Objectifs atteints */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Objectifs atteints
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{resolvedAlerts.length}</span>
          </h2>
        }
      >
        {resolvedAlerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">Aucun objectif atteint pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resolvedAlerts.map((alert) => {
              const colors = categoryColors[alert.category] ?? categoryColors.sales;
              const unit = alert.forecast_type ? (FORECAST_UNITS[alert.forecast_type] || "") : "";

              return (
                <article key={alert.id} className="card border-emerald-200 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                        {categoryLabels[alert.category] ?? alert.category}
                      </span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Objectif atteint</span>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>Créée le {new Date(alert.created_at).toLocaleDateString("fr-FR")}</p>
                      {alert.resolved_at && <p>Atteint le {new Date(alert.resolved_at).toLocaleDateString("fr-FR")}</p>}
                    </div>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{alert.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{alert.description}</p>

                  {alert.forecast_type && alert.current_value != null && alert.threshold != null ? (
                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">
                          {alert.current_value.toLocaleString("fr-FR")}{unit} atteint
                        </p>
                        <p className="text-xs text-emerald-600">
                          Objectif de {alert.threshold.toLocaleString("fr-FR")}{unit} dépassé
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm font-medium text-emerald-800">{alert.impact}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </CollapsibleBlock>
    </section>
  );
}
