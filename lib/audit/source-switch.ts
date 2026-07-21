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
import { getToolKeys } from "@/lib/integrations/tool-mappings";

export type SwitchableTool = { key: string; label: string; domain: string; icon: string };

export async function getSwitchableBillingTools(
  supabase: SupabaseClient,
  orgId: string,
  hubspotToken: string | null,
  /**
   * Page dont le mapping « Outil source par page » (Paramètres → Intégrations)
   * fait FOI : si un mapping existe, seuls les outils mappés sont proposés.
   * Ajouter/retirer un outil dans les paramètres se répercute automatiquement.
   */
  pageKey?: string,
): Promise<SwitchableTool[]> {
  const allConnectedTools = await getConnectedTools(supabase, orgId);
  const billingCategory = allConnectedTools.filter((t) => t.category === "billing");
  let tools = [
    ...allConnectedTools.filter((t) => t.key === "hubspot"),
    // HubSpot accessible via token (legacy/env) même sans ligne integrations.
    ...(hubspotToken && !allConnectedTools.some((t) => t.key === "hubspot")
      ? [{ key: "hubspot", label: "HubSpot", domain: "hubspot.com", icon: "🔶" }]
      : []),
    ...billingCategory,
  ].filter((t, i, arr) => arr.findIndex((x) => x.key === t.key) === i);

  if (pageKey) {
    const mapped = await getToolKeys(supabase, orgId, pageKey);
    if (mapped.length > 0) tools = tools.filter((t) => mapped.includes(t.key));
  }
  return tools;
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

// ── Vues croisées ───────────────────────────────────────────────────────────
// La règle d'affichage multi-sources est DÉCLARATIVE : une vue croisée existe
// si la sélection couvre ses capacités requises via AU MOINS deux outils
// différents (croiser un outil avec lui-même n'est pas un croisement).
// Ajouter un croisement = 1 entrée ici, aucune règle en dur dans les pages.

export type CrossView = {
  key: string;
  label: string;
  /** Capacités que la sélection doit couvrir pour que la vue ait du sens. */
  requires: SourceCapability[];
};

export const CROSS_VIEWS: CrossView[] = [
  { key: "crm-billing", label: "Croisement CRM × Facturation", requires: ["deals", "invoices"] },
];

/**
 * Vues croisées disponibles pour une sélection multi-outils. Une vue n'est
 * proposée que si chaque capacité requise est fournie par la sélection ET que
 * les capacités ne proviennent pas toutes du même outil.
 */
export function availableCrossViews(keys: string[]): CrossView[] {
  if (keys.length < 2) return [];
  return CROSS_VIEWS.filter((view) => {
    const providers = view.requires.map((cap) => keys.filter((k) => capabilitiesOf(k).includes(cap)));
    if (providers.some((p) => p.length === 0)) return false; // capacité non couverte
    // Au moins une combinaison fait intervenir deux outils distincts.
    const distinct = new Set(providers.flat());
    return distinct.size > 1;
  });
}

/**
 * Combos croisées proposées comme raccourci dans le switcher : chaque PAIRE
 * d'outils connectés dont la sélection débloque au moins une vue croisée
 * (ex : « HubSpot × Pennylane »). Entièrement dérivé de CROSS_VIEWS et des
 * outils réellement connectés — rien en dur, un nouvel outil facturation
 * connecté fera apparaître sa combo tout seul.
 */
export type CrossCombo = { keys: string[]; label: string };

export function availableCrossCombos(tools: SwitchableTool[]): CrossCombo[] {
  const combos: CrossCombo[] = [];
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const pair = [tools[i].key, tools[j].key];
      if (availableCrossViews(pair).length > 0) {
        combos.push({ keys: pair, label: `${tools[i].label} × ${tools[j].label}` });
      }
    }
  }
  return combos;
}
