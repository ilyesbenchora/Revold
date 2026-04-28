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

  /** Source API du workflow : v3 = classic legacy, v4 = Workflows 2.0.
   *  Affiché sur la card pour transparence totale (l'utilisateur peut
   *  vérifier dans son HubSpot UI lequel correspond). */
  apiSource: "v3" | "v4";

  /** Lien direct vers le workflow dans HubSpot (construit avec portalId). */
  hubspotUrl?: string;

  /** Description lisible du déclencheur (ex "Création de contact AND
   *  lifecyclestage = lead"). Vide si l'API ne renvoie rien d'exploitable. */
  triggerDescription: string;
  /** Nombre de critères dans enrollmentCriteria. */
  triggerCriteriaCount: number;

  /** Records actuellement enrôlés dans le workflow (snapshot live).
   *  Pour les workflows de contact = nb de contacts, pour les workflows
   *  de deal = nb de transactions, etc. Source : v3 contactCounts.active
   *  ou v4 currentlyEnrolledCount. */
  currentlyEnrolledCount?: number;
  /** Total cumulé des records jamais enrôlés (lifetime). */
  lifetimeEnrolledCount?: number;

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

  /** Performance HubSpot (depuis /automation/v3/performance/{id}). */
  errorCount?: number;
  errorRate?: number; // %
  successCount?: number;
  queuedCount?: number;
  droppedCount?: number;
};

export type WorkflowActionStats = {
  totalActions: number;
  byCategory: Record<WorkflowActionCategory, number>;
  outgoingWebhookHosts: string[];
};

export type WorkflowSummaryItem = {
  id: string;
  name: string;
  enabled: boolean;
  objectType: WorkflowObjectType;
  source: "v4" | "v3_detail" | "v3_inferred" | "unknown";
  /** Si true, /v4/flows/{id} OU /v3/workflows/{id} a renvoyé un détail.
   *  Si false, on ne sait pas grand chose au-delà du nom + ID. */
  hasDetail: boolean;
  /** URL directe HubSpot construite avec portalId. */
  hubspotUrl?: string;
};

export type WorkflowsAuditResult = {
  /** Liste résumée de TOUS les workflows (actifs + inactifs). */
  workflows: WorkflowSummaryItem[];
  /** Détails analysés des workflows ACTIFS qui ont retourné un détail. */
  details: WorkflowDetail[];
  countsByObject: Record<WorkflowObjectType, number>;
  actionStats: WorkflowActionStats;
  /** Diagnostic chargement détail : pour visibilité côté UI. */
  detailLoadStatus: {
    activeCount: number;        // nb workflows actifs
    detailLoaded: number;        // nb dont le détail a été chargé avec succès
    failedIds: Array<{ id: string; name: string; reason: string }>;
  };
  /** portalId résolu (depuis hint ou /oauth/v1/access-tokens). */
  portalId?: string;
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

/**
 * Détecte le PROFIL d'usage du workflow à partir de son nom + ses actions.
 * Permet de filtrer les recommandations qui ne s'appliquent PAS à ce
 * profil (ex: pas besoin de re-enrollment sur un workflow welcome,
 * pas besoin de goal sur un set-property unique).
 */
function detectWorkflowProfile(d: Omit<WorkflowDetail, "recommendations">): {
  profile: "welcome_onboarding" | "notification" | "nurturing_scoring" | "relance" | "set_property_unique" | "routing" | "general";
  needsReenrollment: boolean;
  needsGoal: boolean;
} {
  const name = d.name.toLowerCase();
  const onlySetProperty = d.uniqueActionCategories.length === 1 && d.uniqueActionCategories[0] === "set_property" && d.actions.filter((a) => a.category === "set_property").length === 1;
  const onlyOwnerUpdate = d.uniqueActionCategories.length === 1 && d.uniqueActionCategories[0] === "update_owner";

  if (/welcome|onboard|kickoff|first|d[ée]marrage|bienvenue/.test(name)) {
    // One-shot par contact : re-enrollment nuisible (relancerait l'onboarding)
    // Goal souvent inutile (la fin du flow EST la fin de l'onboarding)
    return { profile: "welcome_onboarding", needsReenrollment: false, needsGoal: false };
  }
  if (/notif|notification|alert|alerte|inform/.test(name)) {
    // Notification interne : pas besoin de re-enrollment ni de goal
    return { profile: "notification", needsReenrollment: false, needsGoal: false };
  }
  if (/nurturing|drip|lead\s*scor|scoring|qualif|education/.test(name)) {
    // Nurturing/scoring : re-enrollment et goal critiques
    return { profile: "nurturing_scoring", needsReenrollment: true, needsGoal: true };
  }
  if (/relance|reactivat|r[eé]veil|re-engage|reengage|dormant|inactif/.test(name)) {
    // Relance : re-enrollment critique (sinon on ne relance qu'1 fois)
    return { profile: "relance", needsReenrollment: true, needsGoal: true };
  }
  if (onlySetProperty) {
    // Workflow utilitaire qui set 1 propriété : pas besoin de goal
    return { profile: "set_property_unique", needsReenrollment: false, needsGoal: false };
  }
  if (onlyOwnerUpdate || /attribut|round[\s-]?robin|rotation|assign|routing/.test(name)) {
    // Routing/round-robin : pas de goal (la rotation EST l'objectif)
    return { profile: "routing", needsReenrollment: false, needsGoal: false };
  }
  return { profile: "general", needsReenrollment: true, needsGoal: true };
}

function buildRecommendations(d: Omit<WorkflowDetail, "recommendations">): WorkflowRecommendation[] {
  const recs: WorkflowRecommendation[] = [];
  const ctx = detectWorkflowProfile(d);

  // ── 1. Re-enrollment : seulement si CONTEXTUELLEMENT nécessaire ──
  if (!d.reenrollmentEnabled && ctx.needsReenrollment) {
    const isCritical = ctx.profile === "relance" || ctx.profile === "nurturing_scoring";
    recs.push({
      severity: isCritical ? "critical" : "warning",
      title: "Re-enrollment désactivé",
      body: ctx.profile === "relance"
        ? "Workflow de relance détecté : sans re-enrollment, un contact ne sera relancé QU'UNE SEULE FOIS — incompatible avec une logique de relance récurrente (ex: relance J+30, J+60)."
        : ctx.profile === "nurturing_scoring"
          ? "Workflow de nurturing/scoring détecté : sans re-enrollment, impossible de re-scorer un contact qui change de stage ou de re-engager un lead qui revient sur le site."
          : "Sans re-enrollment, un record ne peut pas re-passer dans ce workflow s'il remplit à nouveau les critères.",
      recommendation: "Activer 'Allow contacts to re-enroll when they meet the trigger criteria again' dans la configuration du workflow.",
    });
  }

  // ── 2. Goal : seulement si CONTEXTUELLEMENT nécessaire ──
  if (!d.hasGoal && ctx.needsGoal) {
    recs.push({
      severity: ctx.profile === "nurturing_scoring" || ctx.profile === "relance" ? "warning" : "info",
      title: "Aucun objectif (goal) paramétré",
      body: ctx.profile === "nurturing_scoring"
        ? "Workflow de nurturing : sans goal, impossible de mesurer le taux de conversion (ex: % contacts devenus MQL grâce au workflow). Les contacts qui ont déjà converti continuent à recevoir les emails."
        : "Sans goal, les records restent dans le workflow jusqu'à la fin de la séquence. Difficile de mesurer l'impact business.",
      recommendation: ctx.profile === "nurturing_scoring"
        ? "Définir un goal type 'lifecyclestage = MQL' ou 'hs_lead_status = qualified' selon l'objectif business."
        : "Définir un goal explicite quand un record n'a plus besoin du workflow (ex: lifecyclestage = customer).",
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
  // Skip pour les workflows de routing/round-robin qui s'enrôlent légitimement
  // sur la création de tous les records.
  if (d.triggerCriteriaCount === 0 && d.enabled && ctx.profile !== "routing" && ctx.profile !== "set_property_unique") {
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

  // ── Si TOUT est OK pour le profil détecté, on rajoute une note positive ──
  if (recs.length === 0 && d.actions.length > 0) {
    recs.push({
      severity: "info",
      title: `Workflow conforme au profil "${ctx.profile}"`,
      body: "Aucun anti-pattern détecté : configuration cohérente avec l'objectif du workflow.",
      recommendation: "Aucune action requise. Continuer à monitorer les performances du workflow.",
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
  /** Records actuellement dans le workflow (champ v4 disponible selon edition). */
  currentlyEnrolledCount?: number;
  enrollmentStats?: { active?: number; total?: number; lifetime?: number };
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

/** Format v3 workflow detail — TOTALEMENT différent de v4. */
type V3WorkflowDetail = {
  id?: string | number;
  name?: string;
  enabled?: boolean;
  type?: string;
  /** Trigger v3 : segmentCriteria contient les filtres d'enrollment. */
  segmentCriteria?: unknown;
  /** Goal v3. */
  goalCriteria?: unknown;
  /** Actions v3 : array de Record avec field `type` (pas actionTypeId). */
  actions?: Array<Record<string, unknown>>;
  /** Re-enrollment v3 : noms multiples selon version. */
  allowContactToTriggerOnReEnrollment?: boolean;
  reEnrollmentTriggersAllowed?: boolean;
  /** Stats enrollment v3 : disponibles directement dans la réponse detail. */
  contactCounts?: { active?: number; enrolled?: number; total?: number };
  metaData?: {
    allowContactToTriggerOnReEnrollment?: boolean;
    contactCounts?: { active?: number; enrolled?: number };
  };
};

async function fetchV3WorkflowDetail(token: string, id: string): Promise<V3WorkflowDetail | null> {
  try {
    const r = await fetch(`${HS_API}/automation/v3/workflows/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as V3WorkflowDetail;
  } catch {
    return null;
  }
}

/** Convertit un actionType v3 (ex SET_CONTACT_PROPERTY, DELAY, EMAIL) → notre WorkflowActionCategory. */
function categorizeV3Action(type: string): WorkflowActionCategory {
  const t = type.toUpperCase();
  if (t.includes("SET_CONTACT_PROPERTY") || t.includes("SET_PROPERTY") || t.includes("UPDATE_PROPERTY")) return "set_property";
  if (t === "EMAIL" || t.includes("SEND_EMAIL") || t.includes("AUTOMATED_EMAIL")) return "send_email";
  if (t.includes("CREATE_TASK") || t === "TASK") return "create_task";
  if (t.includes("WEBHOOK")) return "webhook";
  if (t.includes("DELAY")) return "delay";
  if (t.includes("BRANCH") || t.includes("IF_THEN")) return "branch";
  if (t.includes("OWNER") || t.includes("ROTATE")) return "update_owner";
  if (t.includes("CREATE_NOTE") || t.includes("ENGAGEMENT")) return "create_engagement";
  return "other";
}

function describeV3Action(a: Record<string, unknown>): string {
  const type = (a.type ?? "UNKNOWN") as string;
  const cat = categorizeV3Action(type);
  switch (cat) {
    case "set_property":
      return `Set ${(a.propertyName ?? "?") as string} = ${String(a.newValue ?? "?").slice(0, 40)}`;
    case "send_email":
      return `Envoi email contentId=${(a.contentId ?? a.emailContentId ?? "?") as string}`;
    case "create_task":
      return `Créer tâche ${(a.subject ?? a.taskSubject ?? "") as string}`.trim();
    case "webhook":
      return `Webhook → ${String(a.webhookUrl ?? a.url ?? "?").slice(0, 60)}`;
    case "delay":
      return `Délai ${String(a.delayMillis ?? a.delta ?? "?")}ms`;
    case "branch":
      return "Branche if/then v3";
    default:
      return type;
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

export async function auditHubSpotWorkflows(
  token: string,
  portalIdHint?: string | null,
): Promise<WorkflowsAuditResult> {
  // Si pas de portalId fourni, on le récupère via /oauth/v1/access-tokens/{token}
  // qui renvoie hub_id (= portalId). Endpoint gratuit, pas de quota.
  let portalId: string | undefined = portalIdHint ?? undefined;
  if (!portalId) {
    try {
      const r = await fetch(`${HS_API}/oauth/v1/access-tokens/${token}`);
      if (r.ok) {
        const info = (await r.json()) as { hub_id?: number };
        if (info.hub_id) portalId = String(info.hub_id);
      }
    } catch {}
  }
  const empty: WorkflowsAuditResult = {
    workflows: [],
    details: [],
    countsByObject: { contact: 0, company: 0, deal: 0, ticket: 0, lead: 0, custom: 0, unknown: 0 },
    actionStats: {
      totalActions: 0,
      byCategory: { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 },
      outgoingWebhookHosts: [],
    },
    detailLoadStatus: { activeCount: 0, detailLoaded: 0, failedIds: [] },
    portalId,
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

  // ── Détail EXHAUSTIF des workflows ACTIFS ──
  // ROUTING : v4 → /v4/flows/{id} ; v3 (source: v3_inferred) → /v3/workflows/{id}
  // Critique : v4/flows/{id} renvoie 404 pour les workflows v3 legacy.
  // Chunks de 5 en parallèle pour ne pas overcharger l'API HubSpot.
  const activeWorkflowsList = [...summaries.values()].filter((w) => w.enabled).slice(0, 200);

  const detailsRaw = await processInChunks(activeWorkflowsList, 5, async (w) => {
    if (w.source === "v4") {
      const v4 = await fetchV4FlowDetail(token, w.id);
      if (v4) return { kind: "v4" as const, data: v4 };
      // Fallback v3 si v4 retourne null (rare mais possible)
      const v3 = await fetchV3WorkflowDetail(token, w.id);
      return v3 ? { kind: "v3" as const, data: v3 } : null;
    }
    // Workflow legacy v3 → essayer v3 d'abord
    const v3 = await fetchV3WorkflowDetail(token, w.id);
    if (v3) return { kind: "v3" as const, data: v3 };
    // Fallback v4 (au cas où)
    const v4 = await fetchV4FlowDetail(token, w.id);
    return v4 ? { kind: "v4" as const, data: v4 } : null;
  });

  // ── Build details ─────────────────────────────────────────────────
  const details: WorkflowDetail[] = [];
  const aggregateCategories: Record<WorkflowActionCategory, number> = {
    set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0,
    delay: 0, create_engagement: 0, update_owner: 0, other: 0,
  };
  let totalActionsAcross = 0;
  const webhookHosts = new Set<string>();

  for (let i = 0; i < activeWorkflowsList.length; i++) {
    const summary = activeWorkflowsList[i];
    const id = summary.id;
    const raw = detailsRaw[i];
    if (!raw) continue;

    let objectType = summary.objectType;
    let actions: WorkflowAction[] = [];
    let reenrollmentEnabled = false;
    let goalDescription: string | undefined;
    let triggerDescription = "";
    let triggerCriteriaCount = 0;
    let currentlyEnrolledCount: number | undefined;
    let lifetimeEnrolledCount: number | undefined;

    if (raw.kind === "v4") {
      const detail = raw.data;
      const objMapped = mapObjectTypeId(detail.objectTypeId);
      if (objMapped !== "unknown") objectType = objMapped;

      actions = (detail.actions ?? []).map((a) => {
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
        return action;
      });

      reenrollmentEnabled = Boolean(
        detail.shouldReEnroll ||
        detail.enrollmentBehavior?.allowContactToReEnroll ||
        detail.enrollmentBehavior?.reEnrollOnTrigger,
      );

      goalDescription = describeGoal(detail.goalCriteria);
      const trigger = describeTriggerCriteria(detail.enrollmentCriteria);
      triggerDescription = trigger.description;
      triggerCriteriaCount = trigger.count;

      currentlyEnrolledCount = detail.currentlyEnrolledCount ?? detail.enrollmentStats?.active;
      lifetimeEnrolledCount = detail.enrollmentStats?.total ?? detail.enrollmentStats?.lifetime;
    } else {
      // V3 detail
      const detail = raw.data;
      actions = (detail.actions ?? []).map((a) => {
        const type = (a.type ?? "UNKNOWN") as string;
        const cat = categorizeV3Action(type);
        const action: WorkflowAction = {
          rawType: type,
          category: cat,
          description: describeV3Action(a),
        };
        if (cat === "webhook") {
          const url = (a.webhookUrl ?? a.url ?? "") as string;
          const host = extractWebhookHost(url as string);
          if (host) {
            action.webhookHost = host;
            webhookHosts.add(host);
          }
        }
        return action;
      });

      reenrollmentEnabled = Boolean(
        detail.allowContactToTriggerOnReEnrollment ||
        detail.reEnrollmentTriggersAllowed ||
        detail.metaData?.allowContactToTriggerOnReEnrollment,
      );

      goalDescription = describeGoal(detail.goalCriteria);
      const trigger = describeTriggerCriteria(detail.segmentCriteria);
      triggerDescription = trigger.description !== "Déclencheur non lisible via API"
        ? trigger.description
        : (detail.type ? `Déclencheur v3 (type ${detail.type})` : "Déclencheur v3 non parsé");
      triggerCriteriaCount = trigger.count;

      currentlyEnrolledCount = detail.contactCounts?.active ?? detail.metaData?.contactCounts?.active;
      lifetimeEnrolledCount = detail.contactCounts?.enrolled ?? detail.contactCounts?.total;
    }

    // Aggregate stats
    for (const a of actions) {
      aggregateCategories[a.category]++;
      totalActionsAcross++;
    }

    const businessCategories = new Set(
      actions.filter((a) => a.category !== "delay" && a.category !== "branch").map((a) => a.category),
    );
    const uniqueActionCategories = [...businessCategories];
    const hasGoal = !!goalDescription;

    const hubspotUrl = portalId
      ? `https://app.hubspot.com/workflows/${portalId}/platform/flow/${id}/edit`
      : undefined;

    const baseDetail: Omit<WorkflowDetail, "recommendations"> = {
      id,
      name: summary.name,
      enabled: summary.enabled,
      objectType,
      flowType: undefined,
      apiSource: raw.kind,
      hubspotUrl,
      triggerDescription,
      triggerCriteriaCount,
      currentlyEnrolledCount,
      lifetimeEnrolledCount,
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

    // Maj objectType dans le summary si on a une valeur lisible
    if (objectType !== "unknown" && summary.objectType !== objectType) {
      summaries.set(id, { ...summary, objectType });
    }
  }

  // Compteurs par objet (sur tous les workflows actifs)
  const all = [...summaries.values()];
  const countsByObject = empty.countsByObject;
  for (const w of all.filter((w) => w.enabled)) countsByObject[w.objectType]++;

  // Diagnostic : pour chaque workflow actif, charge OK ou échec ?
  const failedIds: Array<{ id: string; name: string; reason: string }> = [];
  const detailLoadedIds = new Set(details.map((d) => d.id));
  for (let i = 0; i < activeWorkflowsList.length; i++) {
    if (!detailsRaw[i]) {
      const w = activeWorkflowsList[i];
      failedIds.push({
        id: w.id,
        name: w.name,
        reason: w.source === "v4"
          ? "v4/flows/{id} a échoué + fallback v3 aussi"
          : "v3/workflows/{id} a échoué + fallback v4 aussi",
      });
    }
  }

  // Enrichit la liste workflows avec hasDetail + hubspotUrl
  const workflowsEnriched: WorkflowSummaryItem[] = all.map((w) => ({
    ...w,
    hasDetail: detailLoadedIds.has(w.id),
    hubspotUrl: portalId
      ? `https://app.hubspot.com/workflows/${portalId}/platform/flow/${w.id}/edit`
      : undefined,
  }));

  return {
    workflows: workflowsEnriched,
    details,
    countsByObject,
    actionStats: {
      totalActions: totalActionsAcross,
      byCategory: aggregateCategories,
      outgoingWebhookHosts: [...webhookHosts].sort(),
    },
    detailLoadStatus: {
      activeCount: activeWorkflowsList.length,
      detailLoaded: details.length,
      failedIds,
    },
    portalId,
  };
}
