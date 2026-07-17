export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { ObjectiveCard, type Objective } from "@/components/objectives/objective-card";
import { CreateObjectiveModal } from "@/components/objectives/create-objective-modal";

export default async function ObjectifsPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("objectives")
    .select("id, title, description, impact, category, forecast_type, target, unit_mode, direction, current_value, date_from, date_to, created_at, status")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  const migrationNeeded = !!error && /objectives/.test(error.message);
  const rows = ((data ?? []) as (Objective & { status?: string })[]).filter((o) => (o.status ?? "active") === "active");

  // Complétion réelle : valeur du KPI calculée pour les objectifs auto-trackés.
  const withValues: Objective[] = await Promise.all(
    rows.map(async (o) => {
      if (!o.forecast_type) return o;
      try {
        const v = await resolveKpiValue(supabase, orgId, o.forecast_type, {
          date_from: o.date_from,
          date_to: o.date_to,
        });
        return { ...o, computedValue: typeof v === "number" ? v : null };
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

      {!migrationNeeded && withValues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Aucun objectif pour l&apos;instant. Crée ton premier cap avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {withValues.map((o) => (
            <ObjectiveCard key={o.id} objective={o} />
          ))}
        </div>
      )}
    </section>
  );
}
