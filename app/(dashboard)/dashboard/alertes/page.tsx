export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { SimulationTabs, type SimulationItem, type AlertItem } from "@/components/simulation-tabs";
import { buildContext, buildScenarios } from "../insights-ia/context";

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

  const scenarios = buildScenarios(ctx) as SimulationItem[];
  const alerts = (allAlerts ?? []) as AlertItem[];

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Simulations IA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Simulez l&apos;impact d&apos;améliorations sur vos KPIs et activez des objectifs pour les suivre dans « Mes alertes ».
          </p>
        </div>
        <CreateAlertModal />
      </header>

      <SimulationTabs scenarios={scenarios} alerts={alerts} />
    </section>
  );
}
