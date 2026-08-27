export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { CreateAlertModal } from "@/components/create-alert-modal";

/**
 * Page « Appels » (section Données) — même squelette que Performances mais
 * SANS sous-page : dédiée au phoning. Aucune donnée en dur : la page est
 * préparée et s'active dès qu'un outil d'appels (Aircall, Ringover,
 * CloudTalk…) est connecté et choisi comme source (même gate que les autres
 * pages Données).
 */
export default async function AppelsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Appels</h1>
          <p className="mt-1 text-sm text-slate-500">
            Performance du phoning : volume d&apos;appels, durée moyenne, taux de décroché, activité par commercial —
            dédiée à ton outil d&apos;appels (Aircall, Ringover, CloudTalk…).
          </p>
        </div>
      </header>

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_appels" categories={["phone"]}>
        {/* Tuiles KPI configurables — page préparée, aucun KPI en dur. */}
        <ConfigurableKpiTiles
          supabase={supabase}
          orgId={orgId}
          pageKey="perf_appels"
          defaults={[]}
          tablesPageKey="perf_appels"
        />

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-2xl" aria-hidden>📞</p>
          <p className="mt-2 text-sm font-medium text-slate-700">Ton outil de phoning est connecté — les blocs d&apos;appels arrivent ici.</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Volume d&apos;appels par jour, durée moyenne, taux de décroché, appels entrants/sortants et activité par
            commercial. En attendant, tu peux déjà créer tes propres KPIs avec «&nbsp;＋ Ajouter un KPI&nbsp;».
          </p>
        </div>
      </PageSourcesGate>

      <PageDataTables pageKey="perf_appels" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_appels" categories={["phone"]} />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
