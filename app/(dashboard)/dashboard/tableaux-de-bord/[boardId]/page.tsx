export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BoardTabs, type BoardTab } from "@/components/boards/board-tabs";
import { BoardFrame } from "@/components/boards/board-frame";
import { BoardActions } from "@/components/boards/board-actions";
import { availableBoardTemplates } from "@/lib/boards/board-templates";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un tableau de bord créé par l'utilisateur : page vierge personnalisable —
 * tuiles KPI (funnel de câblage) + tables de données sous la clé board_<id>.
 * Sources : réglage propre au tableau dans « Outil source par page »,
 * héritage de la Vue d'ensemble sinon.
 */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();
  const { boardId } = await params;

  let boards: BoardTab[] = [];
  try {
    const { data } = await supabase
      .from("custom_dashboards")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    boards = (data ?? []) as BoardTab[];
  } catch {
    /* table absente → aucun tableau */
  }
  const board = UUID_RE.test(boardId) ? boards.find((b) => b.id === boardId) : undefined;
  // Templates proposables à la création (entités réellement synchronisées).
  const templates = await availableBoardTemplates(supabase, orgId);

  if (!board) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Tableaux de bord</h1>
        </header>
        <BoardTabs boards={boards} templates={templates} />
        <p className="p-8 text-center text-sm text-slate-500">
          Ce tableau de bord n&apos;existe plus.{" "}
          <Link href="/dashboard/tableaux-de-bord" className="font-medium text-accent hover:underline">
            Revenir à la vue d&apos;ensemble
          </Link>
        </p>
      </section>
    );
  }

  const pageKey = `board_${board.id}`;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{board.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ton tableau de bord : ajoute tes KPIs et tes tables de données, câblés sur les outils choisis
            dans Paramètres → Intégrations → Outil source par page.
          </p>
        </div>
        <BoardActions boardId={board.id} name={board.name} />
      </header>

      {/* Rangée UNIQUE : Vue d'ensemble + tableaux créés + ＋ Nouveau tableau. */}
      <BoardTabs boards={boards} templates={templates} />

      <BoardFrame supabase={supabase} orgId={orgId} pageKey={pageKey} sourceKeys={[pageKey, "tableau_bord"]} />
    </section>
  );
}
