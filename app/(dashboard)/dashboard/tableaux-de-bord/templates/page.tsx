export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BoardTabs, type BoardTab } from "@/components/boards/board-tabs";
import { TemplateGallery } from "@/components/boards/template-gallery";
import { AgentBoardComposer } from "@/components/boards/agent-board-composer";
import { availableBoardTemplates, boardTemplateGallery } from "@/lib/boards/board-templates";

/**
 * Dashboard → Tableaux de bord → Templates : la galerie des compositions
 * prêtes à l'emploi (dérivées des pages de données existantes, activées selon
 * les outils réellement connectés) + le compositeur agent — décris ton besoin,
 * l'agent propose tuiles et tables câblées sur tes données réelles.
 */
export default async function BoardTemplatesPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // Tableaux racines pour la rangée d'onglets (repli sans parent_id).
  let boards: BoardTab[] = [];
  try {
    const { data, error } = await supabase
      .from("custom_dashboards")
      .select("id, name, parent_id")
      .eq("organization_id", orgId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });
    if (error && /parent_id/.test(error.message)) {
      const fb = await supabase
        .from("custom_dashboards")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });
      if (!fb.error) boards = (fb.data ?? []) as BoardTab[];
    } else if (!error) {
      boards = (data ?? []) as BoardTab[];
    }
  } catch {
    /* table absente → pas de tableaux customs */
  }

  const [templates, gallery] = await Promise.all([
    availableBoardTemplates(supabase, orgId),
    boardTemplateGallery(supabase, orgId),
  ]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Des compositions prêtes à l&apos;emploi — dérivées des pages de données Revold et activées selon les
          outils que tu as connectés. Choisis-en une, ou décris ton besoin à l&apos;agent : dans les deux cas le
          tableau créé reste entièrement personnalisable.
        </p>
      </header>

      <BoardTabs boards={boards} templates={templates} />

      {/* ── Compositeur agent : le besoin décrit devient une composition vérifiable. ── */}
      <AgentBoardComposer />

      {/* ── Galerie : toutes les compositions, disponibles ou à débloquer. ── */}
      <TemplateGallery items={gallery} />
    </section>
  );
}
