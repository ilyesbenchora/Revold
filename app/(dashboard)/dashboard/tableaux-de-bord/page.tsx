export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BoardTabs, type BoardTab } from "@/components/boards/board-tabs";
import { BoardFrame } from "@/components/boards/board-frame";
import { availableBoardTemplates } from "@/lib/boards/board-templates";
import { getBoardViewer, listVisibleBoards } from "@/lib/boards/visibility";

// Clé de personnalisation + tool_mappings de la Vue d'ensemble des tableaux.
const PAGE_KEY = "tableau_bord";

/**
 * Dashboard → Tableaux de bord : la Vue d'ensemble (tableau par défaut) + les
 * tableaux créés par l'utilisateur. Chaque tableau est une page vierge
 * entièrement personnalisable — tuiles KPI (funnel de câblage sur les outils
 * choisis dans « Outil source par page ») et tables de données. Pensé pour les
 * connecteurs sur mesure (ERP, outils métier) dont Revold ne peut pas deviner
 * le reporting : l'utilisateur compose le sien, croisé avec ses autres outils.
 */
export default async function TableauxDeBordPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // TABLEAUX RACINES visibles par le lecteur (visibilité privé/équipe/espace) —
  // les onglets (parent_id non nul) vivent dans la rangée de leur tableau.
  const viewer = await getBoardViewer(supabase);
  const boards: BoardTab[] = (await listVisibleBoards(supabase, orgId, viewer)).filter((b) => !b.parent_id);
  // Templates proposables à la création (entités réellement synchronisées).
  const templates = await availableBoardTemplates(supabase, orgId);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Tableaux de bord</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compose tes propres pages de pilotage : KPIs câblés sur tes outils (CRM, facturation, ERP, outils
          métier connectés sur mesure…) et tables de données, croisés comme tu veux.
        </p>
      </header>

      {/* Rangée UNIQUE : Vue d'ensemble + tableaux créés + ＋ Nouveau tableau.
          (Pas de rangée Dashboard ici — Vue d'ensemble / Mes rapports vivent
          dans la sidebar et sur leurs propres pages.) */}
      <BoardTabs boards={boards} templates={templates} />

      <BoardFrame supabase={supabase} orgId={orgId} pageKey={PAGE_KEY} sourceKeys={[PAGE_KEY]} shareTitle="Vue d'ensemble" />
    </section>
  );
}
