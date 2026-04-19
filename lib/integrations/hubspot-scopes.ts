/**
 * Feature gating HubSpot par scope accordé.
 *
 * Les scopes optional ne sont pas tous accordés selon le plan HubSpot du
 * client (Free / Starter / Pro / Enterprise + add-ons). Pour chaque feature
 * Revold qui dépend d'un scope au-delà du strict minimum CRM, on check ici
 * si l'org a vraiment reçu le scope.
 *
 * Usage côté page/server component :
 *   const granted = await getGrantedScopes(supabase, orgId);
 *   if (!hasScope(granted, "automation")) return <NeedsUpgradeBlock scope="automation" />;
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Récupère la liste des scopes effectivement accordés à l'org pour HubSpot. */
export async function getGrantedScopes(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .eq("is_active", true)
    .single();

  const meta = (data?.metadata ?? {}) as { scopes?: string[] };
  return new Set(meta.scopes ?? []);
}

/** Vérifie si un scope est dans la liste accordée. */
export function hasScope(granted: Set<string>, scope: string): boolean {
  return granted.has(scope);
}

/** Vérifie si TOUS les scopes sont présents. */
export function hasAllScopes(granted: Set<string>, scopes: string[]): boolean {
  return scopes.every((s) => granted.has(s));
}

/** Vérifie si AU MOINS UN des scopes est présent. */
export function hasAnyScope(granted: Set<string>, scopes: string[]): boolean {
  return scopes.some((s) => granted.has(s));
}

/**
 * Mapping feature Revold → scopes HubSpot requis. Permet d'auto-générer
 * les compatibility matrices et les blocs "Connectez X pour activer Y".
 */
export const FEATURE_SCOPE_REQUIREMENTS = {
  // Audit / Données
  audit_basic: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
  audit_appointments: ["crm.objects.appointments.read"],
  audit_lifetime_value: ["crm.objects.invoices.read"],

  // Process & Workflows
  workflow_audit: ["automation"],
  sales_sequences: ["automation.sequences.read"],

  // Performances commerciale
  pipeline_analytics: ["crm.objects.deals.read"],
  email_engagement: ["sales-email-read"],
  multi_product_revenue: ["crm.objects.line_items.read"],

  // Performances marketing
  forms_conversion: ["forms"],
  campaign_attribution: ["marketing.campaigns.revenue.read"],
  marketing_events: ["crm.objects.marketing_events.read"],

  // Service client / CSAT
  tickets_health: ["tickets"],
  conversations_inbox: ["conversations.read"],
  feedback_nps: ["crm.objects.feedback_submissions.read"],

  // Revenue cross-source
  hubspot_invoices: ["crm.objects.invoices.read"],
  hubspot_subscriptions: ["crm.objects.subscriptions.read"],
  hubspot_quotes: ["crm.objects.quotes.read"],

  // Coaching / IA
  goals_tracking: ["crm.objects.goals.read"],
  leads_qualification: ["crm.objects.leads.read"],

  // Custom objects (Enterprise)
  custom_objects: ["crm.objects.custom.read", "crm.schemas.custom.read"],

  // Lists / Segmentation
  lists_segmentation: ["crm.lists.read"],

  // Team analytics
  team_structure: ["settings.users.read", "settings.users.teams.read"],
  user_activity: ["crm.objects.users.read"],
} as const;

export type RevoldFeature = keyof typeof FEATURE_SCOPE_REQUIREMENTS;

/** Vérifie si une feature Revold est activable avec les scopes accordés. */
export function isFeatureAvailable(granted: Set<string>, feature: RevoldFeature): boolean {
  return hasAllScopes(granted, [...FEATURE_SCOPE_REQUIREMENTS[feature]]);
}
