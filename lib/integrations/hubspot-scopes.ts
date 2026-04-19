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

// ────────────────────────────────────────────────────────────────────────────
// DÉTECTION DU PLAN HUBSPOT (inférence à partir des scopes accordés)
// ────────────────────────────────────────────────────────────────────────────

export type HubSpotPlanInference = {
  /** Tier global le plus haut détecté */
  tier: "free" | "starter" | "pro" | "enterprise";
  /** Hubs détectés avec leur niveau respectif */
  hubs: {
    sales: "free" | "starter" | "pro" | "enterprise" | null;
    marketing: "free" | "starter" | "pro" | "enterprise" | null;
    service: "free" | "starter" | "pro" | "enterprise" | null;
    cms: "free" | "starter" | "pro" | "enterprise" | null;
    operations: "free" | "starter" | "pro" | "enterprise" | null;
  };
  /** Add-ons détectés */
  addons: string[];
  /** Score d'exploitation (0-100) basé sur la couverture scopes accordés/possibles */
  exploitationScore: number;
};

/**
 * Infère le plan HubSpot du client à partir des scopes effectivement accordés.
 * HubSpot n'expose pas le tier directement via API publique → on triangule
 * via les scopes obtenus (chaque tier débloque un set spécifique).
 */
export function inferHubSpotPlan(granted: Set<string>): HubSpotPlanInference {
  // Sales Hub
  let salesTier: HubSpotPlanInference["hubs"]["sales"] = null;
  if (granted.has("crm.objects.deals.read")) salesTier = "free";
  if (granted.has("crm.objects.goals.read")) salesTier = "starter";
  if (granted.has("crm.objects.leads.read") || granted.has("automation.sequences.read") || granted.has("sales-email-read")) salesTier = "pro";
  if (granted.has("crm.dealsplits.read_write") || granted.has("crm.objects.deals.sensitive.read")) salesTier = "enterprise";

  // Marketing Hub
  let marketingTier: HubSpotPlanInference["hubs"]["marketing"] = null;
  if (granted.has("forms")) marketingTier = "free";
  if (granted.has("ctas.read")) marketingTier = "starter";
  if (granted.has("automation") || granted.has("marketing-email") || granted.has("marketing.campaigns.revenue.read")) marketingTier = "pro";
  if (granted.has("behavioral_events.event_definitions.read_write") || granted.has("communication_preferences.statuses.batch.read")) marketingTier = "enterprise";

  // Service Hub
  let serviceTier: HubSpotPlanInference["hubs"]["service"] = null;
  if (granted.has("tickets") || granted.has("conversations.read")) serviceTier = "free";
  if (granted.has("crm.objects.feedback_submissions.read") || granted.has("cms.knowledge_base.articles.read")) serviceTier = "pro";
  if (granted.has("conversations.custom_channels.read")) serviceTier = "enterprise";

  // CMS Hub
  let cmsTier: HubSpotPlanInference["hubs"]["cms"] = null;
  if (granted.has("content") || granted.has("cms.performance.read")) cmsTier = "pro";
  if (granted.has("cms.functions.read")) cmsTier = "enterprise";

  // Operations Hub (heuristic: automation custom code + custom objects)
  let operationsTier: HubSpotPlanInference["hubs"]["operations"] = null;
  if (granted.has("automation")) operationsTier = "pro";
  if (granted.has("crm.objects.custom.read")) operationsTier = "enterprise";

  // Add-ons
  const addons: string[] = [];
  if (granted.has("crm.objects.invoices.read")) addons.push("HubSpot Invoices");
  if (granted.has("crm.objects.commercepayments.read")) addons.push("HubSpot Payments");
  if (granted.has("crm.objects.subscriptions.read")) addons.push("Subscriptions");
  if (granted.has("crm.objects.appointments.read")) addons.push("Meetings");
  if (granted.has("crm.objects.custom.read")) addons.push("Custom Objects");
  if (granted.has("crm.objects.projects.read")) addons.push("Projects");
  if (granted.has("crm.objects.partner-clients.read")) addons.push("Partner Program");

  // Tier global = max des hubs détectés
  const tierRank = { free: 0, starter: 1, pro: 2, enterprise: 3 };
  const allTiers = [salesTier, marketingTier, serviceTier, cmsTier, operationsTier].filter(
    (t): t is "free" | "starter" | "pro" | "enterprise" => t !== null,
  );
  const maxTier = allTiers.reduce<"free" | "starter" | "pro" | "enterprise">(
    (max, t) => (tierRank[t] > tierRank[max] ? t : max),
    "free",
  );

  // Score d'exploitation : % de scopes accordés vs toute la liste possible
  // (les scopes optionnels du code Revold)
  const exploitationScore = Math.round((granted.size / 70) * 100); // 70 ≈ total scopes possibles

  return {
    tier: maxTier,
    hubs: {
      sales: salesTier,
      marketing: marketingTier,
      service: serviceTier,
      cms: cmsTier,
      operations: operationsTier,
    },
    addons,
    exploitationScore: Math.min(100, exploitationScore),
  };
}

export const TIER_LABELS = {
  free: "Free",
  starter: "Starter",
  pro: "Professional",
  enterprise: "Enterprise",
} as const;

export const HUB_LABELS = {
  sales: "Sales Hub",
  marketing: "Marketing Hub",
  service: "Service Hub",
  cms: "CMS Hub",
  operations: "Operations Hub",
} as const;
