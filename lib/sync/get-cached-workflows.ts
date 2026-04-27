/**
 * Lit les workflows HubSpot depuis le cache Supabase (hubspot_objects).
 *
 * raw_data contient :
 *   - Champs de la liste : id, name, isEnabled, flowType, objectTypeId,
 *     createdAt, updatedAt, revisionId
 *   - Champs du détail (si syncWorkflowsEnriched a réussi) : actions[],
 *     enrollmentCriteria, segmentCriteria, goalCriteria, isReenrollmentEnabled,
 *     contactCounts, etc. + _detail_source ("v4" | "v3")
 *
 * On expose à la fois :
 *   - WorkflowSummaryItem : pour le carousel (toutes les méta)
 *   - WorkflowDetail extracté quand le détail est dispo (analyse profonde)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkflowSummaryItem,
  WorkflowObjectType,
  WorkflowDetail,
  WorkflowAction,
  WorkflowActionCategory,
  WorkflowRecommendation,
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
  if (objectTypeId.startsWith("2-")) return "custom";
  return "unknown";
}

export type EnrichedWorkflowSummary = WorkflowSummaryItem & {
  /** Métadonnées exposées par la liste — utilisées en mode lite */
  flowType?: string;
  createdAt?: string;
  updatedAt?: string;
  revisionId?: number;
};

export async function getCachedWorkflows(
  supabase: SupabaseClient,
  orgId: string,
  portalId?: string,
): Promise<{ workflows: EnrichedWorkflowSummary[]; details: WorkflowDetail[] }> {
  const { data } = await supabase
    .from("hubspot_objects")
    .select("hubspot_id, raw_data")
    .eq("organization_id", orgId)
    .eq("object_type", "workflows");

  const rows = (data ?? []) as Array<{ hubspot_id: string; raw_data: Record<string, unknown> }>;

  const workflows: EnrichedWorkflowSummary[] = rows
    .map((row) => {
      const r = row.raw_data;
      const enabled = r.isEnabled === true || r.enabled === true;
      const id = String(r.id ?? row.hubspot_id);
      const hasDetail = Array.isArray(r.actions) || Array.isArray(r.enrollmentCriteria);
      const detailSource = (r._detail_source as "v4" | "v3" | undefined) ?? "v4";
      const source: WorkflowSummaryItem["source"] = hasDetail
        ? detailSource === "v3"
          ? "v3_detail"
          : "v4"
        : "v4";
      return {
        id,
        name: (r.name as string) ?? `Workflow ${id}`,
        enabled,
        objectType: mapObjectType(r.objectTypeId as string | undefined),
        source,
        hasDetail,
        hubspotUrl: portalId
          ? `https://app.hubspot.com/workflows/${portalId}/platform/flow/${id}/edit`
          : undefined,
        flowType: (r.flowType as string) ?? undefined,
        createdAt: (r.createdAt as string) ?? undefined,
        updatedAt: (r.updatedAt as string) ?? undefined,
        revisionId: r.revisionId !== undefined ? Number(r.revisionId) : undefined,
      };
    })
    .sort((a, b) => {
      // Actifs d'abord, puis par nom
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  // Construit les WorkflowDetail à partir du raw_data (quand disponible)
  const details: WorkflowDetail[] = rows
    .map((row) => buildDetailFromRaw(row.raw_data, row.hubspot_id, portalId))
    .filter((d): d is WorkflowDetail => d !== null);

  return { workflows, details };
}

// ── Construction d'un WorkflowDetail à partir du raw_data ───────────────

const ACTION_TYPE_TO_CATEGORY: Record<string, WorkflowActionCategory> = {
  SET_PROPERTY: "set_property",
  SINGLE_CONNECTION: "set_property",
  PROPERTY_VALUE_UPDATE: "set_property",
  EMAIL: "send_email",
  AUTOMATION_EMAIL: "send_email",
  CREATE_TASK: "create_task",
  TASK: "create_task",
  WEBHOOK: "webhook",
  HTTP_REQUEST: "webhook",
  BRANCH: "branch",
  IF_BRANCH: "branch",
  DELAY: "delay",
  TIME_DELAY: "delay",
  CREATE_ENGAGEMENT: "create_engagement",
  UPDATE_OWNER: "update_owner",
};

function categorizeAction(actionTypeId: string): WorkflowActionCategory {
  if (!actionTypeId) return "other";
  // Format: "0-1" pour les actions natives — on normalise en uppercase comparable
  for (const [prefix, cat] of Object.entries(ACTION_TYPE_TO_CATEGORY)) {
    if (actionTypeId.toUpperCase().includes(prefix)) return cat;
  }
  return "other";
}

function describeAction(action: Record<string, unknown>): string {
  const type = (action.actionTypeId ?? action.type ?? "") as string;
  if (type.toLowerCase().includes("delay")) {
    const fields = (action.fields ?? {}) as Record<string, unknown>;
    return `Délai (${JSON.stringify(fields).slice(0, 80)})`;
  }
  if (type.toLowerCase().includes("email")) return "Envoi d'un email automation";
  if (type.toLowerCase().includes("task")) return "Création d'une tâche";
  if (type.toLowerCase().includes("webhook") || type.toLowerCase().includes("http")) return "Webhook sortant";
  if (type.toLowerCase().includes("property")) return "Modification d'une propriété";
  if (type.toLowerCase().includes("branch")) return "Branche conditionnelle (if/then)";
  return type || "Action sans type identifié";
}

function buildDetailFromRaw(
  raw: Record<string, unknown>,
  fallbackId: string,
  portalId?: string,
): WorkflowDetail | null {
  const id = String(raw.id ?? fallbackId);
  const actionsRaw = (raw.actions ?? []) as Array<Record<string, unknown>>;
  if (actionsRaw.length === 0 && !raw.enrollmentCriteria && !raw.segmentCriteria) {
    return null; // pas de détail = on retourne null, le carousel utilisera le mode lite
  }

  const objectType = mapObjectType(raw.objectTypeId as string | undefined);
  const actions: WorkflowAction[] = actionsRaw.map((a) => {
    const typeId = (a.actionTypeId ?? a.type ?? "") as string;
    return {
      rawType: typeId,
      category: categorizeAction(typeId),
      description: describeAction(a),
    };
  });
  const uniqueActionCategories = Array.from(new Set(actions.map((a) => a.category)));

  // Re-enrollment : v4 = isReenrollmentEnabled, v3 = canEnrollFromSalesforce / re-enrollment in segmentCriteria
  const reenrollmentEnabled = Boolean(
    raw.isReenrollmentEnabled || raw.canReenroll || raw.allowContactToTriggerMultipleTimes,
  );

  // Goal : v4 = goalCriteria, v3 = goal in workflow
  const goalCriteria = raw.goalCriteria as Record<string, unknown> | undefined;
  const hasGoal = Boolean(goalCriteria && Object.keys(goalCriteria).length > 0);
  const goalDescription = hasGoal ? "Objectif paramétré (sortie auto sur condition)" : "Aucun objectif";

  // Trigger description
  const enrollmentCriteria = raw.enrollmentCriteria as Record<string, unknown> | undefined;
  const segmentCriteria = raw.segmentCriteria as Record<string, unknown> | undefined;
  const triggerDescription = enrollmentCriteria
    ? "Enrôlement basé sur des filtres (enrollmentCriteria)"
    : segmentCriteria
      ? "Enrôlement basé sur des segments (segmentCriteria)"
      : "Déclencheur non décrit dans la donnée brute";

  // Counts (si disponibles)
  const contactCounts = (raw.contactCounts ?? {}) as Record<string, unknown>;
  const currentlyEnrolledCount = typeof contactCounts.active === "number" ? contactCounts.active : undefined;
  const lifetimeEnrolledCount = typeof contactCounts.completed === "number" ? contactCounts.completed : undefined;

  // Recommendations (build basique selon l'analyse)
  const recommendations: WorkflowRecommendation[] = [];
  const isMultiPurpose = uniqueActionCategories.length >= 3;
  if (isMultiPurpose) {
    recommendations.push({
      severity: "warning",
      title: "Workflow multi-purpose",
      body: `Ce workflow combine ${uniqueActionCategories.length} types d'actions. La règle CRO est "1 workflow = 1 objectif précis".`,
      recommendation: "Splitter en workflows dédiés par objectif pour faciliter le debug et le maintien.",
    });
  }
  if (!reenrollmentEnabled && /relance|nurturing|scoring|reactivat|réveil|re-engage/i.test((raw.name as string) ?? "")) {
    recommendations.push({
      severity: "warning",
      title: "Re-enrollment désactivé sur workflow de relance",
      body: "Ce workflow semble être un workflow de relance / nurturing mais le re-enrollment est désactivé.",
      recommendation: "Activer le re-enrollment pour que les contacts repassent dans le workflow s'ils retombent dans les critères.",
    });
  }

  return {
    id,
    name: (raw.name as string) ?? `Workflow ${id}`,
    enabled: raw.isEnabled === true || raw.enabled === true,
    apiSource: ((raw._detail_source as string) === "v3" ? "v3" : "v4") as "v3" | "v4",
    objectType,
    triggerDescription,
    triggerCriteriaCount: enrollmentCriteria ? 1 : segmentCriteria ? 1 : 0,
    actions,
    uniqueActionCategories,
    isMultiPurpose,
    reenrollmentEnabled,
    hasGoal,
    goalDescription,
    currentlyEnrolledCount,
    lifetimeEnrolledCount,
    recommendations,
    hubspotUrl: portalId
      ? `https://app.hubspot.com/workflows/${portalId}/platform/flow/${id}/edit`
      : undefined,
  };
}
