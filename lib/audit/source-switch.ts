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

// ── Registre de capacités par outil ─────────────────────────────────────────
// Découple les BLOCS des OUTILS : chaque outil déclare ce qu'il sait fournir,
// chaque bloc/section déclare ce qu'il exige. Ajouter un outil = 1 ligne ici.

export type SourceCapability =
  | "deals"          // CRM : deals gagnés, pipeline pondéré
  | "subscriptions"  // revenu récurrent (MRR/ARR/churn)
  | "invoices"       // facturation : émission, encaissement, impayés
  | "cashflow"       // encaissements/décaissements → trésorerie, runway
  | "ledger";        // écritures comptables → P&L réel, balance reconstruite

export const TOOL_CAPABILITIES: Record<string, SourceCapability[]> = {
  hubspot: ["deals", "subscriptions", "invoices"],
  salesforce: ["deals"],
  pipedrive: ["deals"],
  stripe: ["subscriptions", "invoices"],
  pennylane: ["invoices", "cashflow", "ledger"],
  sellsy: ["invoices"],
  axonaut: ["invoices", "cashflow"],
  quickbooks: ["invoices", "cashflow"],
};

export function capabilitiesOf(toolKey: string): SourceCapability[] {
  return TOOL_CAPABILITIES[toolKey] ?? [];
}

/** Capacités couvertes par une sélection multi-outils. */
export function selectionCapabilities(keys: string[]): Set<SourceCapability> {
  const set = new Set<SourceCapability>();
  for (const k of keys) for (const c of capabilitiesOf(k)) set.add(c);
  return set;
}

/** Valide `?sources=a,b` (multi) : intersection avec les outils connectés, ordre préservé. */
export function validateSourcesParam(
  requested: string | null,
  tools: SwitchableTool[],
): string[] {
  if (!requested) return [];
  const keys = requested.split(",").map((s) => s.trim()).filter(Boolean);
  const connected = new Set(tools.map((t) => t.key));
  return [...new Set(keys.filter((k) => connected.has(k)))];
}
