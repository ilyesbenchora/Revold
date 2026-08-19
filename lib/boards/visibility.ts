/**
 * Visibilité des tableaux de bord / onglets : private (créateur seul),
 * team (pôle → espace de travail), workspace (toute l'organisation).
 *
 * Règles de lecture :
 *  - admin ou membre SANS pôle → voit tout (cohérent avec les espaces de
 *    travail et les droits de cohortes : sans pôle, non restreint) ;
 *  - le créateur voit toujours ses propres tableaux ;
 *  - 'team' → visible si le pôle du lecteur correspond à la colonne team ;
 *  - colonne visibility absente (migration non appliquée) → tout est
 *    'workspace', personne ne perd rien.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentRole } from "@/lib/auth/rbac";
import { poleToWorkspace } from "@/lib/workspaces";

export type BoardVisibility = "private" | "team" | "workspace";
export const BOARD_VISIBILITIES = new Set<BoardVisibility>(["private", "team", "workspace"]);

export type BoardRow = {
  id: string;
  name: string;
  parent_id: string | null;
  visibility: BoardVisibility;
  team: string | null;
  created_by: string | null;
};

export type BoardViewer = {
  userId: string | null;
  /** admin ou membre sans pôle → voit tous les tableaux. */
  unrestricted: boolean;
  /** Espace de travail normalisé du lecteur (sales/marketing/cs/finance) ou null. */
  team: string | null;
};

export async function getBoardViewer(supabase: SupabaseClient): Promise<BoardViewer> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    if (!userId) return { userId: null, unrestricted: true, team: null };
    const role = await getCurrentRole(supabase, userId);
    let pole: string | null = null;
    try {
      const { data } = await supabase.from("profiles").select("pole").eq("id", userId).maybeSingle();
      pole = (data?.pole as string | null) ?? null;
    } catch {
      /* colonne pole absente → non restreint */
    }
    const team = poleToWorkspace(pole);
    return { userId, unrestricted: role === "admin" || !team, team: team === "all" ? null : team };
  } catch {
    return { userId: null, unrestricted: true, team: null };
  }
}

export function boardVisibleTo(b: BoardRow, viewer: BoardViewer): boolean {
  if (viewer.unrestricted) return true;
  if (!b.visibility || b.visibility === "workspace") return true;
  if (b.created_by && b.created_by === viewer.userId) return true;
  if (b.visibility === "team") return !!b.team && b.team === viewer.team;
  return false; // 'private' d'un autre membre
}

/**
 * Tous les tableaux + onglets de l'org, VISIBLES par le lecteur courant.
 * Résilient aux migrations non appliquées (visibility/team, parent_id) :
 * les colonnes absentes retombent sur les défauts « tout visible ».
 */
export async function listVisibleBoards(
  supabase: SupabaseClient,
  orgId: string,
  viewer: BoardViewer,
): Promise<BoardRow[]> {
  const SELECTS = [
    "id, name, parent_id, visibility, team, created_by",
    "id, name, parent_id",
    "id, name",
  ];
  for (const cols of SELECTS) {
    try {
      const { data, error } = await supabase
        .from("custom_dashboards")
        .select(cols)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });
      if (error) continue;
      const rows = ((data ?? []) as unknown as Partial<BoardRow>[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        parent_id: r.parent_id ?? null,
        visibility: (BOARD_VISIBILITIES.has(r.visibility as BoardVisibility) ? r.visibility : "workspace") as BoardVisibility,
        team: r.team ?? null,
        created_by: r.created_by ?? null,
      }));
      const visible = rows.filter((r) => boardVisibleTo(r, viewer));
      // Un onglet dont le tableau parent est invisible reste invisible aussi.
      const visibleIds = new Set(visible.map((r) => r.id));
      return visible.filter((r) => !r.parent_id || visibleIds.has(r.parent_id));
    } catch {
      /* essai suivant */
    }
  }
  return [];
}
