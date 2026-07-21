/**
 * Résolution des outils "switchables" pour les pages de la section Trésorerie.
 *
 * Un outil peut alimenter les blocs s'il est réellement connecté :
 *   - HubSpot (invoices/subscriptions natifs, ou token legacy)
 *   - tout outil billing connecté (Stripe live, Pennylane/Sellsy/… via les
 *     tables canoniques synchronisées)
 *
 * Utilisé par les 3 pages (Vue d'ensemble, Facturation, Paiement) pour le
 * SourceToolSwitcher + la validation du paramètre d'URL `?source=`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectedTools } from "@/lib/integrations/connected-tools";

export type SwitchableTool = { key: string; label: string; domain: string; icon: string };

export async function getSwitchableBillingTools(
  supabase: SupabaseClient,
  orgId: string,
  hubspotToken: string | null,
): Promise<SwitchableTool[]> {
  const allConnectedTools = await getConnectedTools(supabase, orgId);
  const billingCategory = allConnectedTools.filter((t) => t.category === "billing");
  return [
    ...allConnectedTools.filter((t) => t.key === "hubspot"),
    // HubSpot accessible via token (legacy/env) même sans ligne integrations.
    ...(hubspotToken && !allConnectedTools.some((t) => t.key === "hubspot")
      ? [{ key: "hubspot", label: "HubSpot", domain: "hubspot.com", icon: "🔶" }]
      : []),
    ...billingCategory,
  ].filter((t, i, arr) => arr.findIndex((x) => x.key === t.key) === i);
}

/** Valide `?source=` : seul un outil réellement connecté est accepté. */
export function validateSourceParam(
  requested: string | null,
  tools: SwitchableTool[],
): string | null {
  return requested && tools.some((t) => t.key === requested) ? requested : null;
}
