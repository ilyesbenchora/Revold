/**
 * Audit avancé EXHAUSTIF des workflows HubSpot.
 *
 * Pour CHAQUE workflow actif, on récupère le détail complet via
 * /automation/v4/flows/{flowId} qui renvoie :
 *   - objectTypeId (objet enrollé)
 *   - actions (tableau complet des actions)
 *   - enrollmentCriteria (déclencheur — quels records entrent dans le flow)
 *   - canEnrollFromSalesforce / allowContactToTriggerOnReEnrollment / etc.
 *     pour détecter le RE-ENROLLMENT (paramètre critique)
 *   - goalCriteria (objectif paramétré qui sort automatiquement les records)
 *   - exitCriteria (critères de sortie)
 *
 * Résultat exposé :
 *   - WorkflowDetail[] : analyse fine par workflow (déclencheur, actions,
 *     reenrollment, objectif, anti-patterns détectés, reco CRO)
 *   - countsByObject : compteurs par type d'objet (déjà fait)
 *   - aggregateActionStats : stats agrégées toutes actions (déjà fait)
 */

const HS_API = "https://api.hubapi.com";

export type WorkflowObjectType = "contact" | "company" | "deal" | "ticket" | "lead" | "custom" | "unknown";

export type WorkflowActionCategory =
  | "set_property"
  | "send_email"
  | "create_task"
  | "webhook"
  | "branch"
  | "delay"
  | "create_engagement"
  | "update_owner"
  | "other";

export type WorkflowAction = {
  /** ID brut de l'actionType HubSpot. */
  rawType: string;
  category: WorkflowActionCategory;
  /** Description lisible (ex "Set property: lifecycle_stage = lead"). */
  description: string;
  /** Pour les webhooks, le host de l'URL cible. */
  webhookHost?: string;
};

export type WorkflowRecommendation = {
  /** Sévérité de la reco. */
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  /** Action concrète à entreprendre côté HubSpot. */
  recommendation: string;
};

export type WorkflowDetail = {
  id: string;
  name: string;
  enabled: boolean;
  objectType: WorkflowObjectType;
  flowType?: string;

  /** Description lisible du déclencheur (ex "Création de contact AND
   *  lifecyclestage = lead"). Vide si l'API ne renvoie rien d'exploitable. */
  triggerDescription: string;
  /** Nombre de critères dans enrollmentCriteria. */
  triggerCriteriaCount: number;

  /** TRUE si le re-enrollment est explicitement activé (paramètre critique
   *  pour les workflows de relance ou de scoring : sans reenrollment, un
   *  contact ne peut pas être re-traité). */
  reenrollmentEnabled: boolean;

  /** TRUE si un objectif est paramétré (les records sortent automatiquement
   *  du flow quand le goal est atteint — bonne pratique RevOps). */
  hasGoal: boolean;
  /** Description de l'objectif si présent. */
  goalDescription?: string;

  /** Toutes les actions du workflow, dans l'ordre. */
  actions: WorkflowAction[];
  /** Catégories d'actions UNIQUES présentes (sans compter les delays/branches). */
  uniqueActionCategories: WorkflowActionCategory[];

  /** TRUE si on viole le principe RevOps "1 workflow = 1 action principale".
   *  Détecté quand uniqueActionCategories contient > 1 action métier
   *  (set_property + send_email + create_task ensemble par exemple). */
  isMultiPurpose: boolean;

  /** Recommandations CRO/RevOps spécifiques à ce workflow. */
  recommendations: WorkflowRecommendation[];
};

export type WorkflowActionStats = {
  totalActions: number;
  byCategory: Record<WorkflowActionCategory, number>;
  outgoingWebhookHosts: string[];
};

export type WorkflowsAuditResult = {
  /** Liste résumée de tous les workflows (actifs + inactifs). */
  workflows: Array<{
    id: string;
    name: string;
    enabled: boolean;
    objectType: WorkflowObjectType;
    source: "v4" | "v3_detail" | "v3_inferred" | "unknown";
  }>;
  /** Détails analysés des workflows ACTIFS (jusqu'à 200 max). */
  details: WorkflowDetail[];
  countsByObject: Record<WorkflowObjectType, number>;
  actionStats: WorkflowActionStats;
  error?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────

function mapObjectTypeId(id: string | null | undefined): WorkflowObjectType {
  if (!id) return "unknown";
  const s = String(id).toLowerCase();
  if (s === "0-1" || s.includes("contact")) return "contact";
  if (s === "0-2" || s.includes("compan")) return "company";
  if (s === "0-3" || s.includes("deal")) return "deal";
  if (s === "0-5" || s.includes("ticket")) return "ticket";
  if (s === "0-136" || s.includes("lead")) return "lead";
  if (s.startsWith("2-")) return "custom";
  return "unknown";
}

function categorizeAction(actionType: string): WorkflowActionCategory {
  const t = actionType.toUpperCase();
  if (t.includes("SET_PROPERTY") || t.includes("UPDATE_PROPERTY")) return "set_property";
  if (t.includes("SEND_EMAIL") || t.includes("SEND_AUTOMATED_EMAIL") || t.includes("ONE_TO_ONE_EMAIL")) return "send_email";
  if (t.includes("CREATE_TASK")) return "create_task";
  if (t.includes("WEBHOOK") || t.includes("HTTP")) return "webhook";
  if (t.includes("BRANCH") || t.includes("IF_BRANCH")) return "branch";
  if (t.includes("DELAY") || t.includes("WAIT")) return "delay";
  if (t.includes("CREATE_ENGAGEMENT") || t.includes("CREATE_NOTE") || t.includes("LOG_CALL")) return "create_engagement";
  if (t.includes("OWNER") || t.includes("ROTATE")) return "update_owner";
  return "other";
}

function describeAction(actionType: string, fields: Record<string, unknown>): string {
  const cat = categorizeAction(actionType);
  switch (cat) {
    case "set_property": {
      const propName = (fields?.property_name ?? fields?.propertyName ?? fields?.name ?? "?") as string;
      const value = (fields?.property_value ?? fields?.value ?? "?") as string;
      return `Set ${propName} = ${String(value).slice(0, 40)}`;
    }
    case "send_email": {
      const emailId = (fields?.email_id ?? fields?.emailContentId ?? "?") as string;
      return `Envoi email ${emailId}`;
    }
    case "create_task": {
      const subject = (fields?.task_subject ?? fields?.subject ?? "?") as string;
      return `Créer tâche : ${String(subject).slice(0, 50)}`;
    }
    case "webhook": {
      const url = (fields?.webhookUrl ?? fields?.url ?? "?") as string;
      return `Webhook → ${String(url).slice(0, 60)}`;
    }
    case "branch":
      return "Branche if/then";
    case "delay": {
      const v = fields?.delta ?? fields?.delay_amount ?? "?";
      return `Délai ${String(v)}`;
    }
    case "create_engagement":
      return "Engagement / note loggué";
    case "update_owner":
      return "Réassigne owner (round-robin)";
    default:
      return actionType;
  }
}

function extractWebhookHost(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/** Lit une éventuelle description de critères depuis enrollmentCriteria v4. */
function describeTriggerCriteria(crit: unknown): { description: string; count: number } {
  if (!crit || typeof crit !== "object") return { description: "Déclencheur non lisible via API", count: 0 };
  const c = crit as Record<string, unknown>;
  const filterBranches = (c.filterBranches ?? c.filterGroups ?? []) as Array<unknown>;
  let total = 0;
  const parts: string[] = [];
  for (const fb of filterBranches) {
    if (fb && typeof fb === "object") {
      const filters = ((fb as Record<string, unknown>).filters ?? (fb as Record<string, unknown>).filterBranches ?? []) as Array<unknown>;
      for (const f of filters) {
        total++;
        if (parts.length < 3 && f && typeof f === "object") {
          const fr = f as Record<string, unknown>;
          const prop = (fr.property ?? fr.propertyName ?? "?") as string;
          const op = (fr.operation ?? fr.operator ?? "?") as string;
          parts.push(`${prop} ${op}`);
        }
      }
    }
  }
  if (total === 0) return { description: "Création de l'objet (déclencheur sans filter)", count: 0 };
  const desc = parts.length > 0
    ? `${parts.join(" + ")}${total > parts.length ? ` + ${total - parts.length} autre${total - parts.length > 1 ? "s" : ""} critère${total - parts.length > 1 ? "s" : ""}` : ""}`
    : `${total} critère${total > 1 ? "s" : ""}`;
  return { description: desc, count: total };
}

function describeGoal(goal: unknown): string | undefined {
  if (!goal || typeof goal !== "object") return undefined;
  const g = goal as Record<string, unknown>;
  const branches = (g.filterBranches ?? g.filterGroups ?? []) as Array<unknown>;
  if (branches.length === 0) return undefined;
  const filter = (branches[0] as Record<string, unknown>)?.filters as Array<unknown> | undefined;
  if (!filter || filter.length === 0) return "Objectif paramétré (critères non lisibles)";
  const f = filter[0] as Record<string, unknown>;
  return `${f.property ?? f.propertyName ?? "?"} ${f.operation ?? f.operator ?? "?"}`;
}

function buildRecommendations(d: Omit<WorkflowDetail, "recommendations">): WorkflowRecommendation[] {
  const recs: WorkflowRecommendation[] = [];

  // ── 1. Pas de re-enrollment activé ──
  if (!d.reenrollmentEnabled) {
    const isCriticalForReenroll = /relance|nurturing|scoring|réveil|reactivation|re-engage/i.test(d.name);
    recs.push({
      severity: isCriticalForReenroll ? "critical" : "warning",
      title: "Re-enrollment désactivé",
      body: `Sans re-enrollment, un record ne peut pas re-passer dans ce workflow${
        isCriticalForReenroll
          ? " — pourtant le nom suggère un workflow de relance/scoring qui DOIT pouvoir re-traiter le même contact (ex: relance après J+30, re-scoring après changement de stage)."
          : "."
      }`,
      recommendation: "Activer 'Allow contacts to re-enroll when they meet the trigger criteria again' dans la configuration du workflow.",
    });
  }

  // ── 2. Pas d'objectif paramétré ──
  if (!d.hasGoal) {
    recs.push({
      severity: "warning",
      title: "Aucun objectif (goal) paramétré",
      body: "Sans objectif, les records restent dans le workflow indéfiniment (ou jusqu'à la fin du flow). C'est une dette : impossible de mesurer le taux de conversion du workflow, et risque de spam si le contact ne sort jamais.",
      recommendation: "Définir un goal explicite (ex: lifecyclestage = customer pour un workflow de nurturing). HubSpot sortira automatiquement les records qui atteignent l'objectif.",
    });
  }

  // ── 3. Multi-action (anti-pattern RevOps "1 workflow = 1 action") ──
  if (d.isMultiPurpose) {
    recs.push({
      severity: "critical",
      title: "Workflow multi-purpose : 1 workflow = 1 action principale (principe RevOps)",
      body: `Ce workflow combine ${d.uniqueActionCategories.length} types d'actions différentes : ${d.uniqueActionCategories.join(", ")}. Anti-pattern : impossible de mesurer l'efficacité d'une action isolée, et toute modification d'une action impacte les autres.`,
      recommendation: "Découper en N workflows distincts, 1 par objectif (ex: 1 workflow 'Set lifecycle', 1 workflow 'Send email nurturing', 1 workflow 'Create task SDR'). Chaque workflow garde un goal mesurable.",
    });
  }

  // ── 4. Trigger trop large (peu de critères) ──
  if (d.triggerCriteriaCount === 0 && d.enabled) {
    recs.push({
      severity: "warning",
      title: "Déclencheur sans filter — risque d'enrollment massif",
      body: "Le workflow se déclenche sur la simple création de l'objet, sans filtrer par segment (lifecycle, source, etc.). Risque d'enrôler des records non-pertinents et de dégrader la délivrabilité email.",
      recommendation: "Ajouter au moins 1 critère de segmentation (ex: lifecyclestage IN [lead, MQL] ou hs_lead_status NOT IN [closed_lost]).",
    });
  }

  // ── 5. Webhook sortant sans monitoring ──
  const hasWebhook = d.actions.some((a) => a.category === "webhook");
  if (hasWebhook) {
    recs.push({
      severity: "info",
      title: "Webhook sortant détecté — auditer la cible",
      body: `Ce workflow envoie des données à un système externe (${
        d.actions.find((a) => a.webhookHost)?.webhookHost ?? "host inconnu"
      }). Vérifier que la cible est documentée et monitorée (Zapier ne notifie pas en cas d'échec en plan Free).`,
      recommendation: "Ajouter une étape de fallback (Create Task si le webhook échoue) ou utiliser HubSpot Operations Hub workflows avec retry automatique.",
    });
  }

  // ── 6. Trop d'actions (workflow obèse) ──
  if (d.actions.length > 20) {
    recs.push({
      severity: "warning",
      title: `Workflow très volumineux (${d.actions.length} actions)`,
      body: "Au-delà de 20 actions, un workflow devient difficile à maintenir et à débugger. Souvent signe d'un workflow qui devrait être splitté.",
      recommendation: "Identifier les sous-séquences logiques (ex: 'Onboarding J+0', 'Onboarding J+7', 'Onboarding J+30') et les extraire en workflows distincts chaînés via property triggers.",
    });
  }

  return recs;
}

// ── Fetchers ───────────────────────────────────────────────────────────

type V4Flow = { id: string | number; name?: string; isEnabled?: boolean; objectTypeId?: string; type?: string };
type V3Wf = { id: string | number; name?: string; enabled?: boolean; type?: string };

type V4FlowDetail = {
  id?: string | number;
  name?: string;
  isEnabled?: boolean;
  objectTypeId?: string;
  actions?: Array<{
    actionTypeId?: string;
    actionType?: string;
    fields?: Record<string, unknown>;
  }>;
  enrollmentCriteria?: unknown;
  goalCriteria?: unknown;
  /** Re-enrollment HubSpot v4 : `canEnrollFromSalesforce` n'a rien à voir,
   *  ce qu'on cherche c'est `flowMeta.canEnrollFromMembership` ou
   *  `enrollmentCriteria.shouldReEnrollOnTrigger`. Champ varie selon version. */
  shouldReEnroll?: boolean;
  enrollmentBehavior?: { allowContactToReEnroll?: boolean; reEnrollOnTrigger?: boolean };
};

async function fetchV4FlowDetail(token: string, id: string): Promise<V4FlowDetail | null> {
  try {
    const r = await fetch(`${HS_API}/automation/v4/flows/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as V4FlowDetail;
  } catch {
    return null;
  }
}

/** Process en chunks parallèles pour ne pas exploser le rate limit. */
async function processInChunks<T, R>(items: T[], chunkSize: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(worker));
    out.push(...results);
  }
  return out;
}

export async function auditHubSpotWorkflows(token: string): Promise<WorkflowsAuditResult> {
  const empty: WorkflowsAuditResult = {
    workflows: [],
    details: [],
    countsByObject: { contact: 0, company: 0, deal: 0, ticket: 0, lead: 0, custom: 0, unknown: 0 },
    actionStats: {
      totalActions: 0,
      byCategory: { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 },
      outgoingWebhookHosts: [],
    },
  };

  const [v4Res, v3Res] = await Promise.all([
    fetch(`${HS_API}/automation/v4/flows?limit=200`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${HS_API}/automation/v3/workflows`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
  ]);

  const v4: V4Flow[] = v4Res?.ok ? ((await v4Res.json()).results ?? []) : [];
  const v3: V3Wf[] = v3Res?.ok ? ((await v3Res.json()).workflows ?? []) : [];

  if (!v4Res?.ok && !v3Res?.ok) {
    return { ...empty, error: "Scope automation manquant ou aucun workflow accessible." };
  }

  // Liste des workflows résumés (v4 + v3 mergés, déduplication par ID)
  const summaries = new Map<string, { id: string; name: string; enabled: boolean; objectType: WorkflowObjectType; source: "v4" | "v3_detail" | "v3_inferred" | "unknown" }>();

  for (const w of v4) {
    summaries.set(String(w.id), {
      id: String(w.id),
      name: w.name || "Sans nom",
      enabled: w.isEnabled === true,
      objectType: mapObjectTypeId(w.objectTypeId),
      source: "v4",
    });
  }
  for (const w of v3) {
    if (summaries.has(String(w.id))) continue;
    summaries.set(String(w.id), {
      id: String(w.id),
      name: w.name || "Sans nom",
      enabled: w.enabled === true,
      objectType: "unknown",
      source: "v3_inferred",
    });
  }

  // ── Détail EXHAUSTIF des workflows ACTIFS via /v4/flows/{id} ──
  // Chunks de 5 en parallèle pour ne pas overcharger l'API HubSpot.
  // Cap à 200 workflows (tous comptes confondus, exhaustif).
  const activeIds = [...summaries.values()].filter((w) => w.enabled).map((w) => w.id).slice(0, 200);
  const detailsRaw = await processInChunks(activeIds, 5, (id) => fetchV4FlowDetail(token, id));

  // ── Build details ─────────────────────────────────────────────────
  const details: WorkflowDetail[] = [];
  const aggregateCategories: Record<WorkflowActionCategory, number> = {
    set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0,
    delay: 0, create_engagement: 0, update_owner: 0, other: 0,
  };
  let totalActionsAcross = 0;
  const webhookHosts = new Set<string>();

  for (let i = 0; i < activeIds.length; i++) {
    const id = activeIds[i];
    const summary = summaries.get(id)!;
    const detail = detailsRaw[i];
    if (!detail) continue;

    const objectType = mapObjectTypeId(detail.objectTypeId);

    // Actions ────────────────────────────────────────
    const actions: WorkflowAction[] = (detail.actions ?? []).map((a) => {
      const rawType = a.actionTypeId || a.actionType || "UNKNOWN";
      const cat = categorizeAction(rawType);
      const fields = a.fields ?? {};
      const action: WorkflowAction = {
        rawType,
        category: cat,
        description: describeAction(rawType, fields),
      };
      if (cat === "webhook") {
        const url = (fields.webhookUrl ?? fields.url ?? "") as string;
        const host = extractWebhookHost(url);
        if (host) {
          action.webhookHost = host;
          webhookHosts.add(host);
        }
      }
      // Aggregate stats
      aggregateCategories[cat]++;
      totalActionsAcross++;
      return action;
    });

    // Catégories métier uniques (on exclut delay/branch qui sont du
    // contrôle de flux, pas des actions métier)
    const businessCategories = new Set(
      actions
        .filter((a) => a.category !== "delay" && a.category !== "branch")
        .map((a) => a.category),
    );
    const uniqueActionCategories = [...businessCategories];

    // Re-enrollment : check les multiples flags possibles selon version v4
    const reenrollmentEnabled = Boolean(
      detail.shouldReEnroll ||
      detail.enrollmentBehavior?.allowContactToReEnroll ||
      detail.enrollmentBehavior?.reEnrollOnTrigger,
    );

    // Goal
    const goalDescription = describeGoal(detail.goalCriteria);
    const hasGoal = !!goalDescription;

    // Trigger
    const trigger = describeTriggerCriteria(detail.enrollmentCriteria);

    const baseDetail: Omit<WorkflowDetail, "recommendations"> = {
      id,
      name: summary.name,
      enabled: summary.enabled,
      objectType: objectType !== "unknown" ? objectType : summary.objectType,
      flowType: undefined,
      triggerDescription: trigger.description,
      triggerCriteriaCount: trigger.count,
      reenrollmentEnabled,
      hasGoal,
      goalDescription,
      actions,
      uniqueActionCategories,
      isMultiPurpose: uniqueActionCategories.length > 1,
    };

    details.push({
      ...baseDetail,
      recommendations: buildRecommendations(baseDetail),
    });

    // Maj objectType dans le summary si v4 a renvoyé une valeur lisible
    if (objectType !== "unknown") {
      summaries.set(id, { ...summary, objectType, source: "v4" });
    }
  }

  // Compteurs par objet (sur tous les workflows actifs)
  const all = [...summaries.values()];
  const countsByObject = empty.countsByObject;
  for (const w of all.filter((w) => w.enabled)) countsByObject[w.objectType]++;

  return {
    workflows: all,
    details,
    countsByObject,
    actionStats: {
      totalActions: totalActionsAcross,
      byCategory: aggregateCategories,
      outgoingWebhookHosts: [...webhookHosts].sort(),
    },
  };
}
