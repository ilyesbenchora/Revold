/**
 * Lists the tools the user actually connected to Revold (entries in the
 * `integrations` table with `is_active = true`). Used to:
 *   - drive multi-tool aware messaging on Simulations IA + Coaching IA
 *   - decide which cross-source simulations / coachings to surface
 *
 * Distinction with `detectIntegrations()` in detect-integrations.ts:
 *   - detectIntegrations  → scans HubSpot properties to find what's plugged
 *                            into HubSpot (Aircall, PandaDoc, Mailchimp...).
 *   - getConnectedTools   → reads the Revold integrations table to see what
 *                            the user explicitly connected through the
 *                            "Intégrations" page.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTABLE_TOOLS, type ConnectableTool } from "./connect-catalog";

export type ConnectedTool = {
  key: string;
  label: string;
  category: ConnectableTool["category"];
  vendor: string;
  domain: string;
  icon: string;
  connectedAt: string | null;
};

export async function getConnectedTools(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ConnectedTool[]> {
  const { data } = await supabase
    .from("integrations")
    .select("provider, updated_at")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (!data) return [];

  const out: ConnectedTool[] = [];
  for (const row of data) {
    const provider = row.provider as string;
    const def = CONNECTABLE_TOOLS[provider];
    if (!def) continue;
    out.push({
      key: def.key,
      label: def.label,
      category: def.category,
      vendor: def.vendor,
      domain: def.domain,
      icon: def.icon,
      connectedAt: (row.updated_at as string | null) ?? null,
    });
  }
  return out;
}

export type ConnectedSummary = {
  tools: ConnectedTool[];
  byCategory: Record<ConnectableTool["category"], ConnectedTool[]>;
  hasCrm: boolean;
  hasBilling: boolean;
  hasSupport: boolean;
  hasPhone: boolean;
  hasConvIntel: boolean;
  hasCommunication: boolean;
  // Cross-source pairings that unlock specific multi-tool insights
  hasCrmAndBilling: boolean;
  hasCrmAndSupport: boolean;
  hasCrmAndPhone: boolean;
  hasCrmAndConvIntel: boolean;
};

/** Ensemble des catégories d'outils connectées, utilisé par les gates cross-source. */
export function connectedCategoriesSet(tools: ConnectedTool[]): Set<ConnectableTool["category"]> {
  const set = new Set<ConnectableTool["category"]>();
  for (const t of tools) set.add(t.category);
  // HubSpot est CRM — si l'org a connecté HubSpot via OAuth le record existe déjà.
  return set;
}

export function summarizeConnected(tools: ConnectedTool[]): ConnectedSummary {
  const byCategory: ConnectedSummary["byCategory"] = {
    crm: [], billing: [], phone: [], support: [], communication: [], conv_intel: [],
  };
  for (const t of tools) byCategory[t.category].push(t);

  const hasCrm = byCategory.crm.length > 0;
  const hasBilling = byCategory.billing.length > 0;
  const hasSupport = byCategory.support.length > 0;
  const hasPhone = byCategory.phone.length > 0;
  const hasConvIntel = byCategory.conv_intel.length > 0;
  const hasCommunication = byCategory.communication.length > 0;

  return {
    tools,
    byCategory,
    hasCrm, hasBilling, hasSupport, hasPhone, hasConvIntel, hasCommunication,
    hasCrmAndBilling: hasCrm && hasBilling,
    hasCrmAndSupport: hasCrm && hasSupport,
    hasCrmAndPhone: hasCrm && hasPhone,
    hasCrmAndConvIntel: hasCrm && hasConvIntel,
  };
}
