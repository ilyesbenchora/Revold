import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel, getBarColor, getScoreTextColor } from "@/lib/score-utils";

export default async function ProcessPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const latestKpi = await getLatestKpi();

  // Pipeline stages
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, position, probability, is_closed_won, is_closed_lost")
    .eq("organization_id", orgId)
    .order("position", { ascending: true });

  // Deal count per stage
  const { data: deals } = await supabase
    .from("deals")
    .select("stage_id")
    .eq("organization_id", orgId);

  const k = latestKpi;

  // Score Process: inverted inactifs (30%), inverted stagnation (30%), activités/deal (20%), inverted cycle (20%)
  const inactivePct = Number(k?.inactive_deals_pct) || 0;
  const stagnationPct = Number(k?.deal_stagnation_rate) || 0;
  const actPerDeal = Number(k?.activities_per_deal) || 0;
  const cycleDays = Number(k?.sales_cycle_days) || 0;
  const processScore = k ? Math.round(
    Math.max(0, (1 - inactivePct / 50) * 100) * 0.30 +
    Math.max(0, (1 - stagnationPct / 40) * 100) * 0.30 +
    Math.min(100, (actPerDeal / 12) * 100) * 0.20 +
    Math.min(100, Math.max(0, (1 - (cycleDays - 30) / 90) * 100)) * 0.20
  ) : 0;

  // Count deals per stage
  const dealCountByStage: Record<string, number> = {};
  (deals ?? []).forEach((d) => {
    dealCountByStage[d.stage_id] = (dealCountByStage[d.stage_id] || 0) + 1;
  });

  const workflowMetrics = [
    {
      label: "Deals inactifs",
      value: k?.inactive_deals_pct ?? 0,
      suffix: "%",
      description: "Deals sans activité depuis plus de 14 jours",
      inverted: true,
    },
    {
      label: "Taux de stagnation",
      value: k?.deal_stagnation_rate ?? 0,
      suffix: "%",
      description: "Deals restés trop longtemps au même stage",
      inverted: true,
    },
    {
      label: "Activités par deal",
      value: k?.activities_per_deal ?? 0,
      suffix: "",
      description: "Nombre moyen d’interactions par deal",
    },
  ];

  const processKpis = [
    {
      label: "Cycle de vente",
      value: k?.sales_cycle_days ? `${k.sales_cycle_days} jours` : "—",
      description: "Durée moyenne entre création et closing",
    },
    {
      label: "Vélocité deals",
      value: k?.deal_velocity ? `€${(Number(k.deal_velocity) / 1000).toFixed(1)}K par jour` : "—",
      description: "Valeur traitée par jour de pipeline",
    },
    {
      label: "Taux de closing",
      value: k?.closing_rate ? `${k.closing_rate}%` : "—",
      description: "Pourcentage de deals conclus positivement",
    },
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Process</h1>
        <p className="mt-1 text-sm text-slate-500">
          Performance des workflows, lifecycle stages et KPIs process métier.
        </p>
      </header>

      {/* Score global Process */}
      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Process" score={processScore} colorClass="stroke-indigo-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{processScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(processScore).className}`}>
              {getScoreLabel(processScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Santé de vos workflows commerciaux, lifecycle stages et processus métier.
          </p>
        </div>
      </div>

      {/* Lifecycle Stages */}
      {stages && stages.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Lifecycle Stages
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Probabilité</th>
                  <th className="px-4 py-3">Deals actifs</th>
                  <th className="px-4 py-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <tr key={stage.name} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">{stage.name}</td>
                    <td className="px-4 py-3 text-slate-600">{stage.position}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-indigo-500"
                            style={{ width: `${stage.probability}%` }}
                          />
                        </div>
                        <span className="text-slate-600">{stage.probability}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dealCountByStage[stage.id] ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {stage.is_closed_won ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Gagné</span>
                      ) : stage.is_closed_lost ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Perdu</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Ouvert</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workflow Performance */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Performance des Workflows
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {workflowMetrics.map((m) => {
            const numVal = Number(m.value);
            const displayScore = m.inverted ? Math.max(0, 100 - numVal) : numVal;
            return (
              <article key={m.label} className="card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-600">{m.label}</p>
                  <span className={`text-xl font-bold ${getScoreTextColor(displayScore)}`}>
                    {numVal}{m.suffix}
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${getBarColor(displayScore)}`}
                    style={{ width: `${Math.min(100, displayScore)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-400">{m.description}</p>
              </article>
            );
          })}
        </div>
      </div>

      {/* Process Business KPIs */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          KPIs Process Métier
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {processKpis.map((kpi) => (
            <article key={kpi.label} className="card p-5">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="mt-2 text-xs text-slate-400">{kpi.description}</p>
            </article>
          ))}
        </div>
      </div>

      {!latestKpi && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucune donnée disponible. Les métriques apparaîtront une fois les données synchronisées.
          </p>
        </div>
      )}
    </section>
  );
}
