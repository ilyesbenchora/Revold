/**
 * Cadre par défaut d'un tableau de bord — serveur. Même squelette que les
 * pages de données (Ventes…) : gate « Outil source par page », une rangée de
 * tuiles KPI configurables (funnel de câblage sur les outils choisis), puis le
 * CTA « Ajouter une table de données » (PageDataTables, visualisations
 * complètes) en bas. Toute la personnalisation vit sous la clé `pageKey`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { ConfigurableKpiTiles } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { CreateAlertModal } from "@/components/create-alert-modal";

export async function BoardFrame({
  supabase,
  orgId,
  pageKey,
  sourceKeys,
}: {
  supabase: SupabaseClient;
  orgId: string;
  /** Clé de personnalisation du tableau (tuiles + tables). */
  pageKey: string;
  /** Chaîne tool_mappings : clé du tableau, héritage Vue d'ensemble sinon. */
  sourceKeys: string[];
}) {
  return (
    <>
      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey={sourceKeys} categories={["crm", "billing", "support", "ads"]}>
        {/* Rangée de tuiles KPI — vierge par défaut : encarts « ＋ Ajouter un KPI ». */}
        <ConfigurableKpiTiles
          supabase={supabase}
          orgId={orgId}
          pageKey={pageKey}
          defaults={[]}
          tablesPageKey={pageKey}
          placeholderRow
        />
      </PageSourcesGate>

      {/* Tables de données : funnel complet (sources à croiser → KPI → visualisation). */}
      <PageDataTables pageKey={pageKey} />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey={sourceKeys} />

      <CreateAlertModal hideTrigger />
    </>
  );
}
