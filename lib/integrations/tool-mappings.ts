/**
 * Helpers pour le mapping "outil(s) source par page".
 *
 * Stockage : table tool_mappings (organization_id, page_key, tool_keys[]).
 *  - Audit pages → tool_keys contient 1 seul outil (UI single-select).
 *  - Dashboard / Simulations IA / Coaching IA → tool_keys peut contenir
 *    plusieurs outils (UI multi-select).
 *
 * Aucune supposition n'est faite : seuls les outils dont l'organisation
 * possède une intégration active sont proposés / persistés.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTABLE_TOOLS, type ConnectableTool } from "./connect-catalog";

export type ConnectedToolOption = {
  key: string;
  label: string;
  icon: string;
  domain: string;
  category: ConnectableTool["category"];
};

/**
 * Liste les outils actuellement connectés (integrations.is_active = true).
 * Pour les OAuth (HubSpot), on exige refresh_token + portal_id pour éviter les
 * faux positifs sur les seeds legacy.
 */
export async function listConnectedTools(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ConnectedToolOption[]> {
  const { data } = await supabase
    .from("integrations")
    .select("provider, is_active, refresh_token, portal_id, metadata")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const out: ConnectedToolOption[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const provider = row.provider as string;
    if (seen.has(provider)) continue;
    const tool = CONNECTABLE_TOOLS[provider];
    if (!tool) continue;
    if (tool.oauth && (!row.refresh_token || !row.portal_id)) continue;
    seen.add(provider);
    out.push({
      key: tool.key,
      label: tool.label,
      icon: tool.icon,
      domain: tool.domain,
      category: tool.category,
    });
  }
  return out;
}

export async function getToolKeys(
  supabase: SupabaseClient,
  orgId: string,
  pageKey: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("tool_mappings")
    .select("tool_keys")
    .eq("organization_id", orgId)
    .eq("page_key", pageKey)
    .maybeSingle();
  return (data?.tool_keys as string[] | undefined) ?? [];
}

export async function getToolKeysBatch(
  supabase: SupabaseClient,
  orgId: string,
  pageKeys: string[],
): Promise<Record<string, string[]>> {
  if (pageKeys.length === 0) return {};
  const { data } = await supabase
    .from("tool_mappings")
    .select("page_key, tool_keys")
    .eq("organization_id", orgId)
    .in("page_key", pageKeys);
  const out: Record<string, string[]> = {};
  for (const r of data ?? []) {
    out[r.page_key as string] = (r.tool_keys as string[]) ?? [];
  }
  return out;
}

export async function setToolKeys(
  supabase: SupabaseClient,
  orgId: string,
  pageKey: string,
  toolKeys: string[],
  userId: string | null,
): Promise<void> {
  await supabase.from("tool_mappings").upsert(
    {
      organization_id: orgId,
      page_key: pageKey,
      tool_keys: toolKeys,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "organization_id,page_key" },
  );
}

/**
 * Détermine quel outil utiliser pour une page donnée.
 *  1. Si un mapping persisté contient au moins un outil toujours connecté → on
 *     prend le 1er outil persisté qui matche.
 *  2. Sinon, on retourne le 1er outil connecté de la catégorie préférée.
 *  3. Sinon, le 1er outil connecté tout court.
 *  4. Sinon null.
 */
export function resolveActiveTool(
  connected: ConnectedToolOption[],
  persistedKeys: string[],
  preferredCategories: ConnectableTool["category"][] = [],
): ConnectedToolOption | null {
  for (const k of persistedKeys) {
    const explicit = connected.find((t) => t.key === k);
    if (explicit) return explicit;
  }
  for (const cat of preferredCategories) {
    const match = connected.find((t) => t.category === cat);
    if (match) return match;
  }
  return connected[0] ?? null;
}
