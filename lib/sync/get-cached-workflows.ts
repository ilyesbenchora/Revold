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

// Labels FR pour les catégories d'action — utilisés dans les recos
const CATEGORY_LABEL_FR: Record<string, string> = {
  set_property: "modification de propriété",
  send_email: "envoi d'email",
  create_task: "création de tâche",
  webhook: "webhook sortant",
  branch: "branche conditionnelle",
  delay: "délai",
  create_engagement: "engagement (note/call)",
  update_owner: "réassignation owner",
  other: "action diverse",
};

/**
 * Catégorisation des actions HubSpot v4.
 *
 * STRUCTURE RÉELLE des actions v4 :
 *   - type: "SINGLE_CONNECTION" = WRAPPER d'action (la majorité). Le VRAI
 *     type est dans actionTypeId ("0-1" = email, "0-2" = property, etc.)
 *     OU inféré depuis fields (subscriptionId, propertyName, taskTitle...)
 *   - type: "LIST_BRANCH" / "VALUE_BRANCH" = branche if/then
 *   - type: "CUSTOM_CODE" = code custom (catégorie "other")
 *
 * actionTypeId standards HubSpot (format "0-X") :
 *   0-1   = Send email (marketing email)
 *   0-2   = Set contact property
 *   0-3   = Send internal email notification
 *   0-4   = Create task
 *   0-5   = Webhook
 *   0-7   = Add to static list
 *   0-8   = Remove from static list
 *   0-9   = If/then branch (rare en v4 — utilisé via type=LIST_BRANCH)
 *   0-12  = Delay (timer)
 *   0-13  = Trigger another workflow
 *   0-19  = Approval
 *
 * Custom action types ("0-XXXXXXXX" avec ID > 100) :
 *   - subscription preferences (opt-in/opt-out) — categorisé via fields
 *   - autres apps marketplace
 */

const HUBSPOT_ACTION_TYPE_MAP: Record<string, WorkflowActionCategory> = {
  "0-1": "send_email",
  "0-2": "set_property",
  "0-3": "create_engagement", // notification interne
  "0-4": "create_task",
  "0-5": "webhook",
  "0-7": "set_property", // add to list
  "0-8": "set_property", // remove from list
  "0-9": "branch",
  "0-12": "delay",
  "0-13": "other", // trigger workflow
  "0-19": "create_task", // approval
};

function categorizeAction(action: Record<string, unknown>): WorkflowActionCategory {
  const wrapperType = (action.type as string) ?? "";
  const actionTypeId = (action.actionTypeId as string) ?? "";
  const fields = (action.fields ?? {}) as Record<string, unknown>;

  // 1. Wrapper types directs (branch / delay / custom)
  if (/BRANCH/.test(wrapperType)) return "branch";
  if (/DELAY/.test(wrapperType)) return "delay";
  if (wrapperType === "CUSTOM_CODE") return "other";

  // 2. SINGLE_CONNECTION → on regarde l'actionTypeId
  if (HUBSPOT_ACTION_TYPE_MAP[actionTypeId]) {
    return HUBSPOT_ACTION_TYPE_MAP[actionTypeId];
  }

  // 3. Inférence depuis les fields (custom actions, marketplace apps)
  if (fields.subscriptionId !== undefined || fields.optState !== undefined) {
    return "set_property"; // changement de subscription = modification de "préférences"
  }
  if (fields.emailContent !== undefined || fields.subject !== undefined || fields.emailId !== undefined) {
    return "send_email";
  }
  if (fields.taskTitle !== undefined || fields.taskBody !== undefined) {
    return "create_task";
  }
  if (fields.url !== undefined || fields.method !== undefined || fields.webhookUrl !== undefined) {
    return "webhook";
  }
  if (fields.propertyName !== undefined || fields.targetProperty !== undefined) {
    return "set_property";
  }
  if (fields.ownerId !== undefined || fields.assigneeId !== undefined || fields.targetOwner !== undefined) {
    return "update_owner";
  }
  if (fields.callDirection !== undefined || fields.meetingTitle !== undefined || fields.engagementType !== undefined) {
    return "create_engagement";
  }

  return "other";
}

function describeAction(action: Record<string, unknown>): string {
  const wrapperType = (action.type as string) ?? "";
  const actionTypeId = (action.actionTypeId as string) ?? "";
  const fields = (action.fields ?? {}) as Record<string, unknown>;
  const cat = categorizeAction(action);

  // Branches : décrire la condition si possible
  if (cat === "branch") {
    const branchCount = Array.isArray(action.connections) ? (action.connections as unknown[]).length : 0;
    return branchCount > 0 ? `Branche conditionnelle (${branchCount} sortie${branchCount > 1 ? "s" : ""})` : "Branche conditionnelle";
  }

  // Delays : décrire la durée
  if (cat === "delay") {
    const delayMillis = Number(fields.delayMillis ?? fields.duration ?? 0);
    if (delayMillis > 0) {
      const days = Math.round(delayMillis / 86_400_000);
      const hours = Math.round(delayMillis / 3_600_000);
      const mins = Math.round(delayMillis / 60_000);
      if (days >= 1) return `Délai de ${days} jour${days > 1 ? "s" : ""}`;
      if (hours >= 1) return `Délai de ${hours} heure${hours > 1 ? "s" : ""}`;
      if (mins >= 1) return `Délai de ${mins} minute${mins > 1 ? "s" : ""}`;
    }
    return "Délai d'attente";
  }

  // Emails
  if (cat === "send_email") {
    const subject = (fields.subject as string) ?? (fields.emailSubject as string) ?? "";
    return subject ? `Envoi email : « ${subject.slice(0, 50)} »` : "Envoi d'un email automation";
  }

  // Tasks
  if (cat === "create_task") {
    const title = (fields.taskTitle as string) ?? "";
    return title ? `Création tâche : « ${title.slice(0, 50)} »` : "Création d'une tâche";
  }

  // Webhooks
  if (cat === "webhook") {
    const url = (fields.url as string) ?? (fields.webhookUrl as string) ?? "";
    if (url) {
      try {
        const host = new URL(url).hostname;
        return `Webhook → ${host}`;
      } catch {}
    }
    return "Webhook sortant";
  }

  // Property modifications
  if (cat === "set_property") {
    const prop = (fields.propertyName as string) ?? (fields.targetProperty as string) ?? "";
    const value = fields.value !== undefined ? String(fields.value).slice(0, 30) : "";
    if (prop) {
      return value ? `Set ${prop} = ${value}` : `Modification propriété ${prop}`;
    }
    if (fields.subscriptionId !== undefined) {
      const optState = (fields.optState as string) ?? "";
      return `Subscription preference (${optState || "modification"})`;
    }
    return "Modification d'une propriété CRM";
  }

  // Owner update
  if (cat === "update_owner") {
    return "Réassignation d'owner";
  }

  // Engagement
  if (cat === "create_engagement") {
    return "Création d'engagement (note/call/meeting)";
  }

  // Fallback : afficher le type connu pour debug
  return wrapperType || actionTypeId || "Action sans type identifié";
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
      category: categorizeAction(a),
      description: describeAction(a),
    };
  });
  const uniqueActionCategories = Array.from(new Set(actions.map((a) => a.category)));

  // ─── Re-enrollment ─────────────────────────────────────────────────
  // v4 réel : enrollmentCriteria.shouldReEnroll (boolean)
  // v3 réel : allowContactToTriggerMultipleTimes (boolean)
  const enrollmentCriteria = raw.enrollmentCriteria as Record<string, unknown> | undefined;
  const reenrollmentEnabled = Boolean(
    enrollmentCriteria?.shouldReEnroll ||
      raw.allowContactToTriggerMultipleTimes ||
      raw.canReenroll,
  );
  const reenrollTriggers = (enrollmentCriteria?.reEnrollmentTriggersFilterBranches as unknown[]) ?? [];

  // ─── Goal / Sortie automatique ─────────────────────────────────────
  // v4 réel : enrollmentCriteria.unEnrollObjectsNotMeetingCriteria (sortie
  // quand le contact ne remplit plus les critères) + suppressionListIds
  //          (sortie via liste de suppression).
  // v3 réel : goalListId, enrolledIntoGoalList
  const unEnrollOnExit = Boolean(enrollmentCriteria?.unEnrollObjectsNotMeetingCriteria);
  const suppressionListIds = (raw.suppressionListIds as unknown[]) ?? [];
  const goalListId = raw.goalListId;
  const hasGoal = Boolean(unEnrollOnExit || suppressionListIds.length > 0 || goalListId);
  const goalDescription = unEnrollOnExit
    ? "Sortie auto si le contact ne remplit plus les critères d'enrôlement"
    : suppressionListIds.length > 0
      ? `Sortie via ${suppressionListIds.length} liste${suppressionListIds.length > 1 ? "s" : ""} de suppression`
      : goalListId
        ? "Goal list paramétrée (HubSpot v3)"
        : "Aucun objectif de sortie défini — risque d'accumulation indéfinie";

  // ─── Trigger description ──────────────────────────────────────────
  const segmentCriteria = raw.segmentCriteria as Record<string, unknown> | undefined;
  const enrollmentType = enrollmentCriteria?.type as string | undefined;
  const triggerDescription = enrollmentCriteria
    ? `Enrôlement ${enrollmentType ? enrollmentType.toLowerCase().replace("_", " ") : "basé sur des filtres"}${
        reenrollTriggers.length > 0
          ? ` · ${reenrollTriggers.length} trigger(s) de re-enrollment`
          : ""
      }`
    : segmentCriteria
      ? "Enrôlement basé sur des segments (segmentCriteria)"
      : "Déclencheur non décrit dans la donnée brute";

  // Counts (si disponibles)
  const contactCounts = (raw.contactCounts ?? {}) as Record<string, unknown>;
  const currentlyEnrolledCount = typeof contactCounts.active === "number" ? contactCounts.active : undefined;
  const lifetimeEnrolledCount = typeof contactCounts.completed === "number" ? contactCounts.completed : undefined;

  // ─── Performance HubSpot ──────────────────────────────────────────
  // /automation/v3/performance/{id} renvoie typiquement :
  //   { success, error, queued, dropped, ... }
  const perf = (raw._performance ?? {}) as Record<string, unknown>;
  const errorCount = typeof perf.error === "number" ? perf.error : 0;
  const successCount = typeof perf.success === "number" ? perf.success : 0;
  const queuedCount = typeof perf.queued === "number" ? perf.queued : 0;
  const droppedCount = typeof perf.dropped === "number" ? perf.dropped : 0;
  const totalExec = errorCount + successCount + queuedCount + droppedCount;
  const errorRate = totalExec > 0 ? Math.round((errorCount / totalExec) * 100) : 0;

  // ─── DÉTECTION MULTI-ACTION / MULTI-PURPOSE / COMPLEXITÉ ─────────
  // Les "actions métier" = celles qui produisent un effet business
  // observable (vs delay/branch qui sont juste de la plomberie de flow)
  const businessActionCategories = uniqueActionCategories.filter(
    (c) => c !== "delay" && c !== "branch" && c !== "other",
  );
  const businessActionCount = actions.filter(
    (a) => a.category !== "delay" && a.category !== "branch" && a.category !== "other",
  ).length;
  const branchCount = actions.filter((a) => a.category === "branch").length;
  const delayCount = actions.filter((a) => a.category === "delay").length;
  const totalActions = actions.length;

  // Multi-purpose si > 1 catégorie business différente
  const isMultiPurpose = businessActionCategories.length >= 2;

  // Recommendations basées sur les vrais signaux extraits
  const recommendations: WorkflowRecommendation[] = [];

  // 1. Multi-purpose modéré : 2 catégories business
  if (businessActionCategories.length === 2) {
    const catNames = businessActionCategories
      .map((c) => CATEGORY_LABEL_FR[c] ?? c)
      .join(" + ");
    recommendations.push({
      severity: "warning",
      title: `🔀 Workflow multi-objectif : ${catNames}`,
      body: `Ce workflow combine 2 types d'actions business (${catNames}) — la règle RevOps est "1 workflow = 1 objectif précis". Quand ça plante, impossible de savoir quelle partie est en cause sans débugger les ${totalActions} actions une par une.`,
      recommendation: `Splitter en 2 workflows dédiés (1 par catégorie). Chaque workflow devient mesurable individuellement (taux de succès email vs taux de tâches créées) et plus facile à maintenir.`,
    });
  }

  // 2. Multi-purpose grave : 3+ catégories business
  if (businessActionCategories.length >= 3) {
    const catNames = businessActionCategories
      .map((c) => CATEGORY_LABEL_FR[c] ?? c)
      .join(", ");
    recommendations.push({
      severity: "critical",
      title: `🚨 Workflow ultra-complexe : ${businessActionCategories.length} types d'actions business`,
      body: `Ce workflow exécute ${businessActionCategories.length} types d'actions business différents (${catNames}) répartis sur ${totalActions} actions au total. C'est un anti-pattern RevOps majeur : impossible de mesurer ce qu'il fait, impossible de débugger en cas d'erreur, impossible de faire évoluer une partie sans risquer de casser le reste.`,
      recommendation: `Refactor obligatoire : créer ${businessActionCategories.length} workflows dédiés (un par catégorie) avec un objectif business clair pour chaque. Documenter qui consomme la sortie de chaque workflow avant la migration.`,
    });
  }

  // 3. Trop d'actions au total (même catégorie unique)
  if (totalActions > 30) {
    recommendations.push({
      severity: "warning",
      title: `📚 Workflow très long : ${totalActions} actions`,
      body: `Ce workflow contient ${totalActions} actions au total (dont ${branchCount} branches conditionnelles et ${delayCount} delays). À cette taille, le risque de bug silencieux explose : un branch qui rate sa condition, un delay mal paramétré, et tout le funnel en aval ne s'exécute jamais.`,
      recommendation: `Casser ce workflow en 2-3 workflows enchaînés : chacun fait une étape et déclenche le suivant via une propriété de tracking ("step1_completed" → enrôlement workflow 2). Plus facile à monitorer et à maintenir.`,
    });
  } else if (totalActions > 15) {
    recommendations.push({
      severity: "info",
      title: `📋 Workflow long : ${totalActions} actions`,
      body: `${totalActions} actions au total (${branchCount} branches, ${delayCount} delays). Approche la limite de complexité gérable.`,
      recommendation: `Audit : peut-être splittable en 2 workflows enchaînés ? Documenter au minimum la logique métier dans un README interne ou la description HubSpot du workflow.`,
    });
  }

  // 4. Branches excessives = arbre de décision complexe = bug magnet
  if (branchCount >= 5) {
    recommendations.push({
      severity: "warning",
      title: `🌳 Arbre de décision complexe : ${branchCount} branches conditionnelles`,
      body: `Ce workflow contient ${branchCount} branches if/then. À ce niveau de branching, la couverture des cas devient quasi impossible à tester exhaustivement — il y a 2^${branchCount} chemins théoriques possibles.`,
      recommendation: `Modéliser l'arbre sur papier (ou en draw.io) pour identifier les chemins morts ou redondants. Idéalement, simplifier en 1 workflow par persona/segment au lieu de mélanger toutes les conditions dans un seul.`,
    });
  }

  // 5. Mix dangereux : webhook sortant + actions métier
  if (uniqueActionCategories.includes("webhook") && businessActionCategories.length > 1) {
    recommendations.push({
      severity: "warning",
      title: "🔗 Mix webhook + actions métier dans le même workflow",
      body: `Ce workflow envoie un webhook sortant ET exécute d'autres actions métier (email, propriété, etc.). Si le webhook tombe (URL morte, timeout), HubSpot peut bloquer ou retry tout le workflow — y compris les actions métier qui n'ont rien à voir avec le webhook.`,
      recommendation: `Isoler le webhook dans son propre workflow (déclenché en parallèle ou en aval). Comme ça le webhook qui plante n'impacte pas les actions métier critiques.`,
    });
  }

  // 6. Pas de delay sur un workflow long = pression brutale sur le user
  if (totalActions > 5 && delayCount === 0 && uniqueActionCategories.includes("send_email")) {
    recommendations.push({
      severity: "info",
      title: "⚡ Workflow sans aucun delay entre les actions",
      body: `${totalActions} actions enchaînées sans delay — y compris des envois d'email. Risque : tout part en quelques secondes, le destinataire reçoit un mail puis 3 tâches/changements de stage immédiatement, ce qui peut sembler intrusif et casser la confiance.`,
      recommendation: `Ajouter au moins 1 delay (ex: 1h ou 1 jour) entre les actions critiques pour respecter le rythme du destinataire. Standard email nurturing : 3-7 jours entre 2 envois.`,
    });
  }

  if (!reenrollmentEnabled && /relance|nurturing|scoring|reactivat|réveil|re-engage/i.test((raw.name as string) ?? "")) {
    recommendations.push({
      severity: "warning",
      title: "🔁 Re-enrollment désactivé sur workflow de relance",
      body: "Le nom suggère un workflow de relance/nurturing, mais shouldReEnroll = false dans enrollmentCriteria.",
      recommendation: "Activer le re-enrollment dans HubSpot — sinon les contacts qui sortent ne reviennent jamais, même s'ils retombent dans les critères.",
    });
  }

  if (!reenrollmentEnabled && /relance|nurturing|scoring|reactivat|réveil|re-engage/i.test((raw.name as string) ?? "")) {
    recommendations.push({
      severity: "warning",
      title: "🔁 Re-enrollment désactivé sur workflow de relance",
      body: "Le nom suggère un workflow de relance/nurturing, mais shouldReEnroll = false dans enrollmentCriteria.",
      recommendation: "Activer le re-enrollment dans HubSpot — sinon les contacts qui sortent ne reviennent jamais, même s'ils retombent dans les critères.",
    });
  }

  if (!hasGoal && raw.isEnabled) {
    recommendations.push({
      severity: "warning",
      title: "🎯 Aucune sortie automatique paramétrée",
      body: `Ni unEnrollObjectsNotMeetingCriteria, ni suppression list, ni goalListId. Les ${objectType === "deal" ? "deals" : objectType === "contact" ? "contacts" : "records"} enrôlés vont s'accumuler indéfiniment dans le workflow.`,
      recommendation: "Paramétrer dans HubSpot soit (1) « Unenroll objects when they no longer meet enrollment criteria » dans Settings, soit (2) une suppression list, soit (3) un goal explicite. C'est essentiel pour que le workflow se nettoie tout seul.",
    });
  }

  if (errorCount > 0 && totalExec > 0) {
    recommendations.push({
      severity: errorRate >= 10 ? "critical" : "warning",
      title: `⚠️ ${errorCount} erreur${errorCount > 1 ? "s" : ""} d'exécution détectée${errorCount > 1 ? "s" : ""} (${errorRate}% du total)`,
      body: `D'après /automation/v3/performance/${id}, ce workflow a accumulé ${errorCount} échecs d'action sur ${totalExec} exécutions. Les causes typiques : webhook URL morte, propriété supprimée, owner désactivé, scope OAuth perdu.`,
      recommendation: "Ouvrir le workflow dans HubSpot → onglet « Action history » pour identifier l'action qui plante et la corriger.",
    });
  }

  if (queuedCount > 100) {
    recommendations.push({
      severity: "warning",
      title: `⏳ ${queuedCount.toLocaleString("fr-FR")} actions en queue`,
      body: `Ce workflow a ${queuedCount.toLocaleString("fr-FR")} actions en attente d'exécution — soit un délai paramétré (delay step), soit un blocage HubSpot (rate limit interne, dépendances).`,
      recommendation: "Vérifier que les délais paramétrés sont volontaires. Si non : checker les action types (webhook, branch, calculation) qui peuvent ralentir tout le workflow.",
    });
  }

  if (droppedCount > 0 && totalExec > 0 && (droppedCount / totalExec) >= 0.05) {
    recommendations.push({
      severity: "warning",
      title: `🚮 ${droppedCount} record${droppedCount > 1 ? "s" : ""} dropped (${Math.round((droppedCount / totalExec) * 100)}%)`,
      body: "Des records ont été supprimés du workflow avant la fin de leur parcours (suppression list, désinscription manuelle, archivage objet). Taux > 5% = signal à investiguer.",
      recommendation: "Vérifier que les suppression lists ne sont pas trop larges et que les unsubscribes massifs ne sont pas dus à une comm mal ciblée.",
    });
  }

  if (reenrollmentEnabled && reenrollTriggers.length === 0) {
    recommendations.push({
      severity: "info",
      title: "🔁 Re-enrollment activé sans trigger spécifique",
      body: "shouldReEnroll = true mais aucun reEnrollmentTriggersFilterBranches paramétré. HubSpot va re-enrôler dès que tous les critères d'enrôlement sont à nouveau remplis (comportement par défaut).",
      recommendation: "Vérifier si c'est volontaire. Sinon, paramétrer des triggers explicites pour contrôler quand le re-enrollment se déclenche (ex: changement de stage, nouvelle activité).",
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
    errorCount,
    errorRate,
    successCount,
    queuedCount,
    droppedCount,
  };
}
