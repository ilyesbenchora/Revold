export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BoardTabs, type BoardTab } from "@/components/boards/board-tabs";
import { BoardFrame } from "@/components/boards/board-frame";
import { BoardActions } from "@/components/boards/board-actions";
import { availableBoardTemplates } from "@/lib/boards/board-templates";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BASE = "/dashboard/tableaux-de-bord";

type BoardRow = BoardTab & { parent_id?: string | null };

/**
 * Un tableau de bord créé par l'utilisateur, OU l'un de ses onglets
 * (sous-page, parent_id → tableau parent) : page vierge personnalisable —
 * tuiles KPI (funnel de câblage) + tables de données sous la clé board_<id>.
 * Deux rangées : les TABLEAUX racines en haut (« ＋ Nouveau tableau »), puis
 * les ONGLETS du tableau courant (« ＋ Nouvel onglet »).
 * Sources : réglage propre à la page dans « Outil source par page »,
 * héritage du tableau parent puis de la Vue d'ensemble sinon.
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

  // Tous les tableaux + onglets — repli sans parent_id (migration non appliquée).
  let rows: BoardRow[] = [];
  try {
    const full = await supabase
      .from("custom_dashboards")
      .select("id, name, parent_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    let data: unknown = full.data;
    let error = full.error;
    if (error && /parent_id/.test(error.message)) {
      const basic = await supabase
        .from("custom_dashboards")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });
      data = basic.data;
      error = basic.error;
    }
    if (!error) rows = (data as BoardRow[] | null) ?? [];
  } catch {
    /* table absente → aucun tableau */
  }
  const roots = rows.filter((b) => !b.parent_id);
  const board = UUID_RE.test(boardId) ? rows.find((b) => b.id === boardId) : undefined;
  // Templates proposables à la création (entités réellement synchronisées).
  const templates = await availableBoardTemplates(supabase, orgId);

  if (!board) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Tableaux de bord</h1>
        </header>
        <BoardTabs boards={roots} templates={templates} />
        <p className="p-8 text-center text-sm text-slate-500">
          Ce tableau de bord n&apos;existe plus.{" "}
          <Link href={BASE} className="font-medium text-accent hover:underline">
            Revenir à la vue d&apos;ensemble
          </Link>
        </p>
      </section>
    );
  }

  // Tableau RACINE de la page courante (elle-même, ou son parent si onglet).
  const root = board.parent_id ? rows.find((b) => b.id === board.parent_id) ?? board : board;
  const tabsOfRoot = rows.filter((b) => b.parent_id === root.id);
  const pageKey = `board_${board.id}`;
  // Héritage des sources : la page → son tableau parent (si onglet) → Vue d'ensemble.
  const sourceKeys = board.parent_id
    ? [pageKey, `board_${root.id}`, "tableau_bord"]
    : [pageKey, "tableau_bord"];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {board.parent_id ? `${root.name} · ${board.name}` : board.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {board.parent_id ? "Onglet de ton tableau de bord" : "Ton tableau de bord"} : ajoute tes KPIs et
            tes tables de données, câblés sur les outils choisis dans Paramètres → Intégrations → Outil
            source par page.
          </p>
        </div>
        <BoardActions boardId={board.id} name={board.name} />
      </header>

      {/* Rangée 1 — les TABLEAUX : Vue d'ensemble + racines + ＋ Nouveau tableau.
          Sur un onglet, c'est le tableau PARENT qui reste surligné. */}
      <BoardTabs boards={roots} templates={templates} activeHref={`${BASE}/${root.id}`} />

      {/* Rangée 2 — les ONGLETS (sous-pages) du tableau courant + ＋ Nouvel onglet. */}
      <BoardTabs boards={tabsOfRoot} templates={templates} parentId={root.id} />

      <BoardFrame supabase={supabase} orgId={orgId} pageKey={pageKey} sourceKeys={sourceKeys} />
    </section>
  );
}
