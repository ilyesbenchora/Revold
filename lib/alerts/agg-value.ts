import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAggregate } from "@/lib/ai/agents/tool-library";

export type AggSpec = {
  entity?: string;
  groupBy?: string;
  measure?: string;
  field?: string | null;
  /** Ligne précise à isoler (ex : "active" pour les abonnements actifs) ; vide = total. */
  target?: string | null;
  /** Transformation linéaire déterministe (ex : 12 pour passer du MRR à l'ARR). */
  multiplier?: number | null;
  /**
   * Deals uniquement : restreint l'agrégat à UN pipeline (id HubSpot ou nom).
   * Lève l'ambiguïté des libellés d'étape partagés entre pipelines.
   */
  pipeline?: string | null;
};

/**
 * Valeur RÉELLE d'une spec d'agrégat canonique, calculée de façon déterministe
 * sur les données synchronisées (deals HubSpot, subscriptions/invoices Stripe…).
 * `target` isole une ligne (sinon total), `multiplier` applique une conversion
 * linéaire (ARR = sum(MRR) × 12). Renvoie null si non calculable.
 */
export async function valueFromAggSpec(
  supabase: SupabaseClient,
  orgId: string,
  token: string | null,
  spec: AggSpec,
): Promise<number | null> {
  if (!spec || !spec.entity || !spec.groupBy) return null;
  try {
    const res = await computeAggregate(supabase, orgId, [], token, {
      entity: spec.entity,
      groupBy: spec.groupBy,
      measure: spec.measure || "count",
      field: spec.field ?? null,
      pipeline: spec.pipeline ?? null,
    });
    if (res.error) return null;
    const rows = (res.rows as { group: string; value: number }[] | undefined) ?? [];
    const target = spec.target;
    const base = !target || target === "Total"
      ? rows.reduce((s, r) => s + (r.value || 0), 0)
      : (rows.find((r) => r.group === target)?.value ?? 0);
    const mult = typeof spec.multiplier === "number" && spec.multiplier > 0 ? spec.multiplier : 1;
    return Math.round(base * mult);
  } catch {
    return null;
  }
}
