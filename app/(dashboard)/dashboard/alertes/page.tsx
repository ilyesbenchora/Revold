export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot, getSnapshotMeta } from "@/lib/supabase/cached";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { SimulationTabs, type SimulationItem, type AlertItem } from "@/components/simulation-tabs";
import { MultiToolBanner } from "@/components/multi-tool-banner";
import { BlockedSimulationsNotice } from "@/components/blocked-simulations-notice";
import { DataFreshnessIndicator } from "@/components/data-freshness-indicator";
import { getConnectedTools, summarizeConnected, connectedCategoriesSet } from "@/lib/integrations/connected-tools";
import { buildContext, buildScenarios, detectBlockedSimulations } from "../insights-ia/context";

export default async function ScenariosPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const [ctx, { data: allAlerts }, snapshot, connectedTools, meta] = await Promise.all([
    buildContext(supabase, orgId),
    supabase
      .from("alerts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    getHubspotSnapshot(),
    getConnectedTools(supabase, orgId),
    getSnapshotMeta(),
  ]);
  const connectedSummary = summarizeConnected(connectedTools);
  const connectedCats = connectedCategoriesSet(connectedTools);

  // Les simulations sont gatées par catégorie d'outil connecté. Sans billing
  // branché, les sims revenue MRR/NRR/LTV/factures sont retirées (pas de
  // données inventées) et un encart « Connectez X » s'affiche à la place.
  const scenarios = buildScenarios(ctx, connectedCats) as SimulationItem[];
  const blockedSims = detectBlockedSimulations(ctx, connectedCats);
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

      <DataFreshnessIndicator computedAt={meta.computedAt} source={meta.source ?? "sync"} />

      <MultiToolBanner summary={connectedSummary} />

      {blockedSims.length > 0 && <BlockedSimulationsNotice blocked={blockedSims} />}

      <SimulationTabs
        scenarios={scenarios}
        alerts={alerts}
        pipelines={snapshot.pipelines.map((p) => ({
          id: p.id,
          label: p.label,
          stages: p.stages.map((s) => ({
            id: s.id,
            label: s.label,
            probability: s.probability,
            closedWon: s.closedWon,
            closedLost: s.closedLost,
          })),
        }))}
      />
    </section>
  );
}
