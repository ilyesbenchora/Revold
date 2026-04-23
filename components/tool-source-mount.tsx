/**
 * Mount serveur du <ToolSourceSelector />.
 *
 * Récupère :
 *   - les outils connectés (table integrations)
 *   - le mapping persisté pour cette page (table tool_mappings)
 *
 * Et passe le tout au composant client. À utiliser dans chaque page d'audit /
 * coaching / simulation / dashboard où on veut laisser l'utilisateur choisir
 * son outil source.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  listConnectedTools,
  getToolMapping,
  resolveActiveTool,
  type ConnectedToolOption,
} from "@/lib/integrations/tool-mappings";
import type { ConnectableTool } from "@/lib/integrations/connect-catalog";
import { ToolSourceSelector } from "./tool-source-selector";

export type ResolvedTool = ConnectedToolOption;

export async function loadToolMapping({
  pageKey,
  preferredCategories,
}: {
  pageKey: string;
  preferredCategories: ConnectableTool["category"][];
}): Promise<{
  options: ConnectedToolOption[];
  selectedKey: string | null;
  active: ConnectedToolOption | null;
}> {
  const orgId = await getOrgId();
  if (!orgId) return { options: [], selectedKey: null, active: null };
  const supabase = await createSupabaseServerClient();
  const [options, selectedKey] = await Promise.all([
    listConnectedTools(supabase, orgId),
    getToolMapping(supabase, orgId, pageKey),
  ]);
  const active = resolveActiveTool(options, selectedKey, preferredCategories);
  return { options, selectedKey, active };
}

export async function ToolSourceMount({
  pageKey,
  pageLabel,
  preferredCategories,
}: {
  pageKey: string;
  pageLabel: string;
  preferredCategories: ConnectableTool["category"][];
}) {
  const { options, selectedKey, active } = await loadToolMapping({
    pageKey,
    preferredCategories,
  });
  // Si un mapping est résolu mais aucun choix explicite n'a été fait, on
  // affiche quand même le selector (l'utilisateur peut toujours changer).
  return (
    <ToolSourceSelector
      pageKey={pageKey}
      pageLabel={pageLabel}
      options={options}
      selectedKey={selectedKey ?? active?.key ?? null}
    />
  );
}
