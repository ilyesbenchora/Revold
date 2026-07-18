export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { valueFromAggSpec, type AggSpec } from "@/lib/alerts/agg-value";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { loadEntitiesWithData, isKpiDataReady } from "@/lib/alerts/entity-readiness";
import { ObjectiveCard, type Objective } from "@/components/objectives/objective-card";
import { CreateObjectiveModal } from "@/components/objectives/create-objective-modal";
import { completionPct, isReached, isAtRisk } from "@/lib/objectives/completion";

const TEAM_LABEL: Record<string, string> = {
  sales: "Ventes", commercial: "Ventes", revops: "RevOps", marketing: "Marketing", finance: "Finance", csm: "Service client",
};

export default async function ObjectifsPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const COLS: string = "id, title, description, impact, category, forecast_type, agg_spec, target, unit_mode, direction, current_value, date_from, date_to, created_at, status";
  let res = await supabase.from("objectives").select(COLS).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);
  if (res.error && /agg_spec/.test(res.error.message)) {
    res = await supabase.from("objectives").select(COLS.replace(", agg_spec", "")).eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);
  }
  const { data, error } = res;

  const migrationNeeded = !!error && /objectives/.test(error.message);
  const rows = ((data ?? []) as unknown as (Objective & { status?: string })[]).filter((o) => (o.status ?? "active") === "active");
  const token = rows.some((o) => !o.forecast_type && o.agg_spec) ? await getHubSpotToken(supabase, orgId) : null;
  const readySet = rows.length > 0 ? await loadEntitiesWithData(supabase, orgId) : new Set<string>();

  // Complétion réelle : valeur calculée pour les objectifs auto-trackés
  // (KPI catalogué OU agrégat rattaché, ex : ARR = sum(MRR)×12).
  const withValues: Objective[] = await Promise.all(
    rows.map(async (o) => {
      try {
        if (o.forecast_type) {
          const v = await resolveKpiValue(supabase, orgId, o.forecast_type, { date_from: o.date_from, date_to: o.date_to });
          return { ...o, computedValue: typeof v === "number" ? v : null };
        }
        if (o.agg_spec) {
          const v = await valueFromAggSpec(supabase, orgId, token, o.agg_spec as AggSpec);
          return { ...o, computedValue: typeof v === "number" ? v : null };
        }
        return o;
      } catch {
        return o;
      }
    }),
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Objectifs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fixe des caps clairs et suis leur complétion en temps réel. À l&apos;approche de l&apos;échéance, Revold te
            propose le plan (analyses + actions) pour les atteindre.
          </p>
        </div>
        <CreateObjectiveModal />
      </header>

      {migrationNeeded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Table <code>objectives</code> absente — applique la migration Supabase <code>20260717000002_objectives.sql</code>.
        </div>
      )}

      {/* Tableau de suivi manager — vue d'ensemble par pôle */}
      {!migrationNeeded && withValues.length > 0 && (() => {
        const total = withValues.length;
        const reached = withValues.filter(isReached).length;
        const atRisk = withValues.filter((o) => isAtRisk(o)).length;
        const avg = Math.round(withValues.reduce((s, o) => s + completionPct(o), 0) / total);
        const byTeam = new Map<string, { count: number; sum: number; risk: number }>();
        for (const o of withValues) {
          const k = o.category ?? "revops";
          const e = byTeam.get(k) ?? { count: 0, sum: 0, risk: 0 };
          e.count++; e.sum += completionPct(o); if (isAtRisk(o)) e.risk++;
          byTeam.set(k, e);
        }
        return (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Suivi manager</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-[10px] uppercase tracking-wide text-slate-400">Objectifs</p><p className="mt-1 text-2xl font-bold text-slate-900">{total}</p></div>
              <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-[10px] uppercase tracking-wide text-slate-400">Complétion moy.</p><p className="mt-1 text-2xl font-bold text-indigo-600">{avg}%</p></div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center"><p className="text-[10px] uppercase tracking-wide text-emerald-500">Atteints</p><p className="mt-1 text-2xl font-bold text-emerald-700">{reached}</p></div>
              <div className="rounded-lg bg-amber-50 p-3 text-center"><p className="text-[10px] uppercase tracking-wide text-amber-600">À risque</p><p className="mt-1 text-2xl font-bold text-amber-700">{atRisk}</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {[...byTeam.entries()].map(([team, e]) => {
                const p = Math.round(e.sum / e.count);
                return (
                  <div key={team} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs font-medium text-slate-600">{TEAM_LABEL[team] ?? team}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : e.risk > 0 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, p)}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-[11px] text-slate-500">{p}% · {e.count} obj.{e.risk > 0 ? ` · ${e.risk} ⚠` : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {!migrationNeeded && withValues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Aucun objectif pour l&apos;instant. Crée ton premier cap avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {withValues.map((o) => (
            <ObjectiveCard key={o.id} objective={o} dataReady={isKpiDataReady(readySet, o.forecast_type, o.agg_spec)} />
          ))}
        </div>
      )}
    </section>
  );
}
