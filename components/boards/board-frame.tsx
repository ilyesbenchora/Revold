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
import { BoardAsk } from "@/components/boards/board-ask";
import { BoardShareButton } from "@/components/boards/board-share-button";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeysChain } from "@/lib/integrations/tool-mappings";

export async function BoardFrame({
  supabase,
  orgId,
  pageKey,
  sourceKeys,
  shareTitle,
}: {
  supabase: SupabaseClient;
  orgId: string;
  /** Clé de personnalisation du tableau (tuiles + tables). */
  pageKey: string;
  /** Chaîne tool_mappings : clé du tableau, héritage Vue d'ensemble sinon. */
  sourceKeys: string[];
  /** Titre figé sur la page publique quand le tableau est partagé. */
  shareTitle?: string;
}) {
  // Même règle que le gate : aucun outil source mappé pour la page → le CTA
  // « Créer une table de données » renvoie le MÊME message au clic, au lieu
  // d'ouvrir un funnel sans source.
  const [connected, mapped] = await Promise.all([
    getConnectedTools(supabase, orgId),
    getToolKeysChain(supabase, orgId, sourceKeys),
  ]);
  const sourcesLocked =
    connected.filter((t) => t.category !== "communication" && mapped.includes(t.key)).length === 0;

  return (
    <>
      {/* Partage public en lecture seule (lien /partage/<jeton>, révocable). */}
      <div className="flex justify-end">
        <BoardShareButton pageKey={pageKey} title={shareTitle} />
      </div>

      {/* Tableau conversationnel : pose une question, l'agent recalcule en
          déterministe — masqué tant qu'aucun outil source n'alimente la page. */}
      {!sourcesLocked && <BoardAsk pageKey={pageKey} />}

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
      <PageDataTables pageKey={pageKey} sourcesLocked={sourcesLocked} />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey={sourceKeys} />

      <CreateAlertModal hideTrigger />
    </>
  );
}
