import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, planHasFeature, type FeatureKey, type PlanKey } from "./plans";

/**
 * Plan de l'organisation : org_subscriptions (source billing) d'abord,
 * fallback organizations.plan. Renvoie null si aucun plan reconnu (essai
 * piloté à part, comptes internes) — convention des paywalls Revold :
 * null = ne jamais bloquer.
 */
export async function getOrgPlan(supabase: SupabaseClient, orgId: string): Promise<PlanKey | null> {
  try {
    const { data: sub } = await supabase
      .from("org_subscriptions")
      .select("plan")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (sub?.plan && sub.plan in PLANS) return sub.plan as PlanKey;
    const { data: org } = await supabase
      .from("organizations")
      .select("plan")
      .eq("id", orgId)
      .maybeSingle();
    const p = String(org?.plan ?? "").toLowerCase();
    if (p in PLANS) return p as PlanKey;
  } catch {
    // tables absentes / erreur réseau → on ne bloque jamais à tort
  }
  return null;
}

/**
 * Une feature est verrouillée uniquement si le plan est CONNU et ne l'inclut
 * pas. Org sans plan reconnu → jamais verrouillé.
 */
export function featureLocked(plan: PlanKey | null, feature: FeatureKey): boolean {
  return plan !== null && !planHasFeature(plan, feature);
}
