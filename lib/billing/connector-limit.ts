import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, type PlanKey } from "./plans";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";

/**
 * Application de la limite d'intégrations par plan (PLANS[plan].maxConnectors :
 * Starter 3 · Growth 6 · Scale illimité), vérifiée à CHAQUE point d'entrée qui
 * active une intégration (action clé API, callbacks OAuth, import fichier).
 *
 * Règles :
 *  - la catégorie « communication » (Slack, Teams, Gmail…) ne compte pas :
 *    ce sont des canaux de notification, pas des sources de données ;
 *  - reconnecter un outil déjà actif est toujours permis ;
 *  - org sans plan reconnu (trial piloté à part, comptes internes) → illimité.
 */

const EXEMPT_CATEGORIES = new Set(["communication"]);

export type ConnectorLimitCheck = {
  allowed: boolean;
  /** null = illimité. */
  limit: number | null;
  /** Intégrations actives comptées dans la limite. */
  current: number;
  plan: PlanKey | null;
};

function countsTowardLimit(provider: string): boolean {
  const cat = CONNECTABLE_TOOLS[provider]?.category;
  // Outil hors catalogue (ex : hubspot, pivot CRM) → compte dans la limite.
  return !cat || !EXEMPT_CATEGORIES.has(cat);
}

export async function checkConnectorLimit(
  supabase: SupabaseClient,
  orgId: string,
  /** Outil qu'on s'apprête à connecter (omis = simple lecture de l'usage). */
  provider?: string,
): Promise<ConnectorLimitCheck> {
  let plan: PlanKey | null = null;
  try {
    // Source billing d'abord (org_subscriptions), fallback organizations.plan.
    const { data: sub } = await supabase
      .from("org_subscriptions")
      .select("plan")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (sub?.plan && sub.plan in PLANS) plan = sub.plan as PlanKey;
    if (!plan) {
      const { data: org } = await supabase
        .from("organizations")
        .select("plan")
        .eq("id", orgId)
        .maybeSingle();
      const p = String(org?.plan ?? "").toLowerCase();
      if (p in PLANS) plan = p as PlanKey;
    }
  } catch {
    // tables absentes / erreur réseau → on ne bloque jamais une connexion à tort
  }
  const limit = plan ? PLANS[plan].maxConnectors : null;

  const { data } = await supabase
    .from("integrations")
    .select("provider")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  const providers = new Set(
    ((data ?? []) as Array<{ provider: string | null }>).map((r) => r.provider).filter((p): p is string => !!p),
  );
  const current = [...providers].filter(countsTowardLimit).length;

  // Reconnexion d'un outil déjà actif, ou outil hors limite : toujours permis.
  if (provider && (providers.has(provider) || !countsTowardLimit(provider))) {
    return { allowed: true, limit, current, plan };
  }
  return { allowed: limit === null || current < limit, limit, current, plan };
}

/** Message utilisateur standard quand la limite est atteinte. */
export function connectorLimitMessage(check: ConnectorLimitCheck): string {
  const planName = check.plan ? PLANS[check.plan].name : "actuel";
  return (
    `Limite d'intégrations atteinte (${check.current}/${check.limit}) pour le plan ${planName}. ` +
    "Déconnectez un outil ou passez au plan supérieur pour en connecter davantage."
  );
}
