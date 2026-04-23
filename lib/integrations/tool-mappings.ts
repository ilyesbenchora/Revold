/**
 * Helpers pour le mapping "outil source par page".
 *
 * Logique :
 *   - Liste les outils ACTUELLEMENT connectés à Revold (table integrations).
 *   - Lit / écrit le choix de l'utilisateur dans la table tool_mappings.
 *
 * Aucune supposition n'est faite : seuls les outils dont l'organisation
 * possède une intégration active sont proposés.
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
    // OAuth-only providers : exiger refresh_token + portal_id
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

export async function getToolMapping(
  supabase: SupabaseClient,
  orgId: string,
  pageKey: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tool_mappings")
    .select("tool_key")
    .eq("organization_id", orgId)
    .eq("page_key", pageKey)
    .maybeSingle();
  return (data?.tool_key as string | undefined) ?? null;
}

export async function getToolMappings(
  supabase: SupabaseClient,
  orgId: string,
  pageKeys: string[],
): Promise<Record<string, string>> {
  if (pageKeys.length === 0) return {};
  const { data } = await supabase
    .from("tool_mappings")
    .select("page_key, tool_key")
    .eq("organization_id", orgId)
    .in("page_key", pageKeys);
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    out[r.page_key as string] = r.tool_key as string;
  }
  return out;
}

export async function setToolMapping(
  supabase: SupabaseClient,
  orgId: string,
  pageKey: string,
  toolKey: string,
  userId: string | null,
): Promise<void> {
  await supabase.from("tool_mappings").upsert(
    {
      organization_id: orgId,
      page_key: pageKey,
      tool_key: toolKey,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "organization_id,page_key" },
  );
}

/**
 * Détermine quel outil utiliser pour une page donnée :
 *   1. Si un mapping explicite existe → on l'utilise (s'il est toujours connecté).
 *   2. Sinon, on retourne le premier outil connecté qui correspond à la
 *      catégorie souhaitée (ex : "crm" pour audit/sales/dashboard).
 *   3. Sinon, on retourne le premier outil connecté.
 *   4. Sinon null.
 */
export function resolveActiveTool(
  connected: ConnectedToolOption[],
  mapping: string | null,
  preferredCategories: ConnectableTool["category"][] = [],
): ConnectedToolOption | null {
  if (mapping) {
    const explicit = connected.find((t) => t.key === mapping);
    if (explicit) return explicit;
  }
  for (const cat of preferredCategories) {
    const match = connected.find((t) => t.category === cat);
    if (match) return match;
  }
  return connected[0] ?? null;
}
