export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PerformancesTabs } from "@/components/performances-tabs";
import { MarketingTabs } from "@/components/marketing-tabs";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { CreateAlertModal } from "@/components/create-alert-modal";

/**
 * Sous-page « Publicité » de Performances → Marketing. Aucune donnée en dur :
 * la page est préparée et s'active dès qu'un outil Ads (Google Ads, Meta Ads,
 * LinkedIn Ads…) est connecté et choisi comme source — les KPIs publicitaires
 * (dépenses, CPC, CPL, ROAS, conversions) vivront ici.
 */
export default async function PerformancePublicitePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
          <p className="mt-1 text-sm text-slate-500">
            Performance publicitaire : dépenses, coût par clic et par lead, ROAS et conversions par campagne.
          </p>
        </div>
      </header>

      <PerformancesTabs />
      <MarketingTabs />

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_perf_ads" categories={["ads"]}>
        {/* Tuiles KPI configurables — page préparée, aucun KPI en dur. */}
        <ConfigurableKpiTiles
          supabase={supabase}
          orgId={orgId}
          pageKey="perf_ads"
          defaults={[]}
          tablesPageKey="perf_ads"
        />

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-2xl" aria-hidden>📣</p>
          <p className="mt-2 text-sm font-medium text-slate-700">Ton outil publicitaire est connecté — les KPIs Ads arrivent ici.</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Dépenses par campagne, impressions, clics, CPC, CPL, ROAS et conversions — croisés avec le CRM pour relier
            chaque euro dépensé au pipeline généré. En attendant, tu peux déjà créer tes propres KPIs avec
            «&nbsp;＋ Ajouter un KPI&nbsp;».
          </p>
        </div>
      </PageSourcesGate>

      <PageDataTables pageKey="perf_ads" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_perf_ads" />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
