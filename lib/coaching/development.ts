import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PLAN DE DÉVELOPPEMENT — le cœur du coaching « processus ».
 *
 * Un plan = une COMPÉTENCE à acquérir (« structurer ma découverte client »),
 * découpée en étapes datées, et reliée à un OBJECTIF BUSINESS TÉMOIN
 * (objectives.id). C'est ce lien qui rend le progrès vérifiable : l'étape est
 * cochée ET le KPI bouge — ou l'étape est cochée et le KPI ne bouge pas, ce
 * qui est l'information la plus utile pour ajuster le plan.
 */

export type DevelopmentStep = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "todo" | "doing" | "done" | "skipped";
  completed_at: string | null;
  evidence: string | null;
};

export type DevelopmentPlan = {
  id: string;
  category: string;
  agent_key: string | null;
  objective_id: string | null;
  title: string;
  why: string | null;
  target_behavior: string | null;
  start_date: string;
  target_date: string | null;
  status: "active" | "achieved" | "paused" | "dropped";
  baseline_value: number | null;
  steps: DevelopmentStep[];
  /** Progression des étapes (0-100). */
  stepProgress: number;
  /** Preuve business : objectif témoin (valeur actuelle vs cible). */
  witness?: {
    title: string;
    current: number | null;
    target: number | null;
    unit: string | null;
    direction: string | null;
    /** Progression business (0-100) — null si non calculable. */
    progress: number | null;
  } | null;
};

/** Progression business d'un objectif témoin, bornée 0-100. */
function witnessProgress(current: number | null, target: number | null, direction: string | null, baseline: number | null): number | null {
  if (current == null || target == null || target === 0) return null;
  if (direction === "below") {
    // Objectif « rester sous » : le progrès se mesure depuis le point de départ.
    if (baseline != null && baseline > target) {
      const done = (baseline - current) / (baseline - target);
      return Math.max(0, Math.min(100, Math.round(done * 100)));
    }
    return current <= target ? 100 : Math.max(0, Math.min(100, Math.round((target / current) * 100)));
  }
  const base = baseline ?? 0;
  if (target <= base) return current >= target ? 100 : null;
  return Math.max(0, Math.min(100, Math.round(((current - base) / (target - base)) * 100)));
}

/** Plans d'une catégorie de coaching, étapes + preuve business incluses. */
export async function loadDevelopmentPlans(
  supabase: SupabaseClient,
  orgId: string,
  category: string,
  opts: { includeArchived?: boolean } = {},
): Promise<DevelopmentPlan[]> {
  let q = supabase
    .from("development_plans")
    .select("*")
    .eq("organization_id", orgId)
    .eq("category", category)
    .order("created_at", { ascending: false });
  if (!opts.includeArchived) q = q.in("status", ["active", "paused"]);
  const { data: plans, error } = await q;
  // Migration non appliquée / table absente : le coaching continue de fonctionner.
  if (error || !plans || plans.length === 0) return [];

  const planIds = plans.map((p) => p.id as string);
  const [{ data: steps }, { data: objectives }] = await Promise.all([
    supabase.from("development_steps").select("*").in("plan_id", planIds).order("position", { ascending: true }),
    (async () => {
      const ids = plans.map((p) => p.objective_id).filter((x): x is string => !!x);
      if (ids.length === 0) return { data: [] as Array<Record<string, unknown>> };
      return supabase.from("objectives").select("id, title, current_value, target, unit_mode, direction").in("id", ids);
    })(),
  ]);

  const stepsByPlan = new Map<string, DevelopmentStep[]>();
  for (const s of (steps ?? []) as Array<DevelopmentStep & { plan_id: string }>) {
    const list = stepsByPlan.get(s.plan_id) ?? [];
    list.push(s);
    stepsByPlan.set(s.plan_id, list);
  }
  const objById = new Map(
    ((objectives ?? []) as Array<{ id: string; title: string; current_value: number | null; target: number | null; unit_mode: string | null; direction: string | null }>)
      .map((o) => [o.id, o]),
  );

  return plans.map((p) => {
    const list = stepsByPlan.get(p.id as string) ?? [];
    const done = list.filter((s) => s.status === "done").length;
    const obj = p.objective_id ? objById.get(p.objective_id as string) : null;
    return {
      id: p.id as string,
      category: p.category as string,
      agent_key: (p.agent_key as string) ?? null,
      objective_id: (p.objective_id as string) ?? null,
      title: p.title as string,
      why: (p.why as string) ?? null,
      target_behavior: (p.target_behavior as string) ?? null,
      start_date: p.start_date as string,
      target_date: (p.target_date as string) ?? null,
      status: p.status as DevelopmentPlan["status"],
      baseline_value: (p.baseline_value as number) ?? null,
      steps: list,
      stepProgress: list.length > 0 ? Math.round((done / list.length) * 100) : 0,
      witness: obj
        ? {
            title: obj.title,
            current: obj.current_value,
            target: obj.target,
            unit: obj.unit_mode,
            direction: obj.direction,
            progress: witnessProgress(obj.current_value, obj.target, obj.direction, (p.baseline_value as number) ?? null),
          }
        : null,
    };
  });
}

/**
 * Bloc injecté dans le system prompt : le coach connaît le plan en cours, son
 * étape courante et la preuve business — il coache SUR le plan, pas à côté.
 */
export function planDirective(plans: DevelopmentPlan[]): string {
  const active = plans.filter((p) => p.status === "active");
  if (active.length === 0) {
    return [
      "PLAN DE DÉVELOPPEMENT : aucun plan en cours.",
      "Si la séance fait émerger une compétence à travailler dans la durée, PROPOSE explicitement d'ouvrir un plan de développement (titre, pourquoi, comportement cible, 3 à 5 étapes datées, et l'objectif business qui servira de preuve).",
    ].join("\n");
  }
  const lines = active.map((p) => {
    const next = p.steps.find((s) => s.status !== "done" && s.status !== "skipped");
    const w = p.witness;
    return [
      `- Plan « ${p.title} » (${p.stepProgress} % des étapes faites${p.target_date ? `, échéance ${p.target_date}` : ""})`,
      p.target_behavior ? `  Comportement cible : ${p.target_behavior}` : "",
      next ? `  ÉTAPE EN COURS : « ${next.title} »${next.due_date ? ` (à faire pour le ${next.due_date})` : ""}` : "  Toutes les étapes sont faites — conclure le plan ou en ouvrir un nouveau.",
      w ? `  Preuve business : ${w.title} = ${w.current ?? "?"}${w.target != null ? ` / cible ${w.target}` : ""}${w.progress != null ? ` (${w.progress} % de progression)` : ""}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [
    "PLAN DE DÉVELOPPEMENT EN COURS — c'est le fil rouge de la séance :",
    ...lines,
    "Commence par le point sur l'étape en cours. Confronte l'avancement DÉCLARÉ à la preuve business : si l'étape est faite mais que le chiffre ne bouge pas, dis-le et ajuste le plan plutôt que de féliciter.",
  ].join("\n");
}
