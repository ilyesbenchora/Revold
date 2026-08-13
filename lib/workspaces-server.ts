/**
 * Espace de travail actif, côté serveur.
 *
 * La sidebar (client) mémorise le choix d'espace de l'admin dans un cookie
 * (WORKSPACE_COOKIE) en plus du localStorage : les pages serveur peuvent ainsi
 * filtrer leur contenu (ex : cartes des coachs de la vue d'ensemble Coaching)
 * avec exactement les mêmes règles que la navigation.
 *
 * - membre avec pôle → l'espace de son pôle (le cookie est ignoré) ;
 * - admin → le cookie s'il est valide, sinon vue globale ;
 * - non authentifié / erreur → vue globale (jamais bloquant).
 */

import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { poleToWorkspace, WORKSPACES, WORKSPACE_COOKIE, type WorkspaceId } from "./workspaces";

export async function getActiveWorkspace(): Promise<WorkspaceId> {
  try {
    const user = await getAuthUser();
    if (!user) return "all";

    const supa = await createSupabaseServerClient();
    const first = await supa.from("profiles").select("role, pole").eq("id", user.id).maybeSingle();
    let prof = first.data as { role?: string | null; pole?: string | null } | null;
    // Résilience : colonne pole absente (migration non appliquée).
    if (first.error && /pole/.test(first.error.message)) {
      const fb = await supa.from("profiles").select("role").eq("id", user.id).maybeSingle();
      prof = fb.data as { role?: string | null } | null;
    }

    if (prof?.role === "admin") {
      const saved = (await cookies()).get(WORKSPACE_COOKIE)?.value as WorkspaceId | undefined;
      return saved && WORKSPACES.some((w) => w.id === saved) ? saved : "all";
    }
    return poleToWorkspace(prof?.pole) ?? "all";
  } catch {
    return "all";
  }
}
