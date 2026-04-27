/**
 * Lit les workflows HubSpot depuis le cache Supabase (hubspot_objects).
 *
 * Source primaire pour la page Automatisations — garantit qu'on affiche
 * TOUS les workflows présents dans HubSpot (33 dans le cas pilote), pas
 * juste ceux que l'audit live arrive à pull avant timeout/429.
 *
 * Le rich detail (actions, triggers, re-enrollment, etc.) reste fait par
 * auditHubSpotWorkflows en parallèle — on merge les deux résultats.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkflowSummaryItem,
  WorkflowObjectType,
} from "@/lib/integrations/hubspot-workflows";

// HubSpot objectTypeId → notre WorkflowObjectType
const OBJECT_TYPE_MAP: Record<string, WorkflowObjectType> = {
  "0-1": "contact",
  "0-2": "company",
  "0-3": "deal",
  "0-5": "ticket",
  "0-136": "lead",
};

function mapObjectType(objectTypeId: string | undefined): WorkflowObjectType {
  if (!objectTypeId) return "unknown";
  if (OBJECT_TYPE_MAP[objectTypeId]) return OBJECT_TYPE_MAP[objectTypeId];
  // 2-XXX = custom object
  if (objectTypeId.startsWith("2-")) return "custom";
  return "unknown";
}

export async function getCachedWorkflows(
  supabase: SupabaseClient,
  orgId: string,
  portalId?: string,
): Promise<WorkflowSummaryItem[]> {
  const { data } = await supabase
    .from("hubspot_objects")
    .select("hubspot_id, raw_data")
    .eq("organization_id", orgId)
    .eq("object_type", "workflows");

  return ((data ?? []) as Array<{ hubspot_id: string; raw_data: Record<string, unknown> }>)
    .map((row) => {
      const r = row.raw_data;
      const enabled = (r.isEnabled === true) || (r.enabled === true);
      const id = String(r.id ?? row.hubspot_id);
      return {
        id,
        name: (r.name as string) ?? `Workflow ${id}`,
        enabled,
        objectType: mapObjectType(r.objectTypeId as string | undefined),
        source: "v4" as const,
        hasDetail: false, // sera mis à true par l'audit live si détail dispo
        hubspotUrl: portalId ? `https://app.hubspot.com/workflows/${portalId}/platform/flow/${id}/edit` : undefined,
      };
    })
    // Tri : actifs d'abord, puis par nom
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
